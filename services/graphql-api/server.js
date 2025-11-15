const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub, withFilter } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const { createServer } = require('http');
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');

const app = express();
const pubsub = new PubSub();

// --- Tipe Notifikasi ---
const TASK_ADDED = 'TASK_ADDED';
const TASK_UPDATED = 'TASK_UPDATED';

// --- Data In-Memory ---
// Data ini akan disinkronkan berdasarkan data yang masuk dari header gateway
let users = [
  { id: '1', name: 'Admin User', teamId: 'team1' },
  { id: '2', name: 'Basic User', teamId: 'team1' }
];

let tasks = [
  {
    id: 't1',
    title: 'Implement Authentication (REST)',
    description: 'Use JWT with RS256 in user-service.',
    status: 'inprogress',
    assigneeId: '1',
    teamId: 'team1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 't2',
    title: 'Refactor Frontend UI',
    description: 'Switch to task-based UI and add login.',
    status: 'todo',
    assigneeId: '2',
    teamId: 'team1',
    createdAt: new Date().toISOString(),
  }
];

// --- GraphQL Schema ---
const typeDefs = `
  enum TaskStatus {
    todo
    inprogress
    done
    archived
  }

  type Task {
    id: ID!
    title: String!
    description: String
    status: TaskStatus!
    teamId: ID!
    assigneeId: ID
    createdAt: String!
    assignee: User # Relasi ke User
  }

  type User {
    id: ID!
    name: String!
    teamId: ID!
  }

  type Query {
    # Dapatkan semua tugas (otomatis difilter berdasarkan teamId dari token)
    myTasks: [Task!]!
    # Dapatkan satu tugas
    task(id: ID!): Task
  }

  type Mutation {
    createTask(title: String!, description: String, assigneeId: ID): Task!
    updateTaskStatus(id: ID!, status: TaskStatus!): Task!
    assignTask(id: ID!, assigneeId: ID!): Task!
  }

  type Subscription {
    # Notifikasi saat tugas ditambahkan (real-time)
    taskAdded: Task!
    # Notifikasi saat tugas diperbarui (real-time)
    taskUpdated: Task!
  }
`;

// --- GraphQL Resolvers ---
const resolvers = {
  Query: {
    // Filter tugas berdasarkan teamId dari user yang login (didapat dari context)
    myTasks: (_, __, context) => {
      if (!context.teamId) throw new Error("Not authorized or not part of a team.");
      return tasks.filter(task => task.teamId === context.teamId);
    },
    task: (_, { id }, context) => {
      const task = tasks.find(task => task.id === id);
      if (!task) return null;
      // Pastikan user hanya bisa melihat task di timnya
      if (task.teamId !== context.teamId) throw new Error("Not authorized");
      return task;
    },
  },

  Task: {
    // Resolve nested field 'assignee'
    assignee: (parentTask) => {
      // (Di dunia nyata, ini mungkin memanggil User Service)
      return users.find(user => user.id === parentTask.assigneeId) || null;
    },
  },

  Mutation: {
    createTask: (_, { title, description, assigneeId }, context) => {
      if (!context.teamId) throw new Error("You must be in a team to create tasks.");
      
      const newTask = {
        id: uuidv4(),
        title,
        description: description || '',
        status: 'todo',
        teamId: context.teamId, // Ambil dari token
        assigneeId: assigneeId || null,
        createdAt: new Date().toISOString(),
      };
      tasks.push(newTask);
      
      // Terbitkan notifikasi
      pubsub.publish(TASK_ADDED, { taskAdded: newTask });
      return newTask;
    },

    updateTaskStatus: (_, { id, status }, context) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) { throw new Error('Task not found'); }
      
      // Verifikasi kepemilikan tim
      if (tasks[taskIndex].teamId !== context.teamId) throw new Error("Not authorized");

      tasks[taskIndex].status = status;
      const updatedTask = tasks[taskIndex];
      
      pubsub.publish(TASK_UPDATED, { taskUpdated: updatedTask });
      return updatedTask;
    },

    assignTask: (_, { id, assigneeId }, context) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) { throw new Error('Task not found'); }
      
      // Verifikasi kepemilikan tim
      if (tasks[taskIndex].teamId !== context.teamId) throw new Error("Not authorized");

      // (Cek jika assigneeId ada di tim yang sama)
      
      tasks[taskIndex].assigneeId = assigneeId;
      const updatedTask = tasks[taskIndex];

      pubsub.publish(TASK_UPDATED, { taskUpdated: updatedTask });
      return updatedTask;
    }
  },

  Subscription: {
    taskAdded: {
      // Filter notifikasi agar hanya dikirim ke anggota tim yang relevan
      subscribe: withFilter(
        () => pubsub.asyncIterator(TASK_ADDED),
        (payload, variables, context) => {
          // context di sini adalah context dari WebSocket
          return payload.taskAdded.teamId === context.teamId;
        }
      ),
    },
    taskUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(TASK_UPDATED),
        (payload, variables, context) => {
          return payload.taskUpdated.teamId === context.teamId;
        }
      ),
    },
  },
};

// --- Start Server ---
async function startServer() {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const httpServer = createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ 
    schema,
    // Context untuk WebSocket (Subscriptions)
    context: (ctx) => {
      // API Gateway seharusnya sudah memverifikasi token
      // dan meneruskannya via connectionParams
      const authHeader = ctx.connectionParams?.authorization || '';
      const token = authHeader.split(' ')[1];
      
      if (token) {
        // Di aplikasi nyata, kita akan memverifikasi token lagi di sini
        // atau mempercayai header yang diteruskan gateway.
        // Untuk demo ini, kita asumsikan gateway sudah meneruskan info.
        // Jika gateway tidak bisa meneruskan header di WS, kita harus parse token di sini.
        console.log("WS connectionParams:", ctx.connectionParams);
        
        // Coba decode (tanpa verifikasi, karena gateway sudah)
        // const decoded = jwt.decode(token);
        // return { teamId: decoded.teamId };
        
        // Untuk demo ini, kita akan mock berdasarkan token (jika diperlukan)
        // Tapi kita akan mengandalkan header 'x-team-id' dari gateway
        // yang seharusnya sudah ditambahkan ke req
      }
      
      console.log('WebSocket Client Connected');
      // Kita return context kosong, akan diisi oleh HTTP context
      return {}; 
    },
    onDisconnect: () => {
      console.log('WebSocket Client Disconnected');
    }
  }, wsServer);

  const server = new ApolloServer({
    schema,
    // Context untuk HTTP (Query, Mutation)
    // Ambil header kustom yang DITERUSKAN oleh API Gateway
    context: ({ req }) => {
      const userId = req.headers['x-user-id'];
      const teamId = req.headers['x-team-id'];
      
      // Jika user ada di db in-memory kita, tambahkan
      if (userId && !users.find(u => u.id === userId)) {
         users.push({
            id: userId,
            name: req.headers['x-user-name'] || 'New User',
            teamId: teamId
         });
      }

      return {
        userId,
        teamId,
        email: req.headers['x-user-email']
      };
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Task Service (GraphQL) running on port ${PORT}`);
    console.log(`📡 Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'task-service-graphql',
    tasks: tasks.length
  });
});

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});