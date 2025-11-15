'use client';

import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
  split
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

// --- Link HTTP (untuk Queries, Mutations) ---
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
});

// --- Link WebSocket (untuk Subscriptions) ---
const wsLink = typeof window !== 'undefined'
  ? new GraphQLWsLink(createClient({
      url: process.env.NEXT_PUBLIC_GRAPHQL_WS_URL!,
      connectionParams: () => {
        // Kirim token saat koneksi WebSocket
        const token = localStorage.getItem('token');
        return {
          authorization: token ? `Bearer ${token}` : '',
        };
      },
    }))
  : null;

// --- Link Autentikasi (untuk HTTP) ---
const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
});

// --- Gabungkan Link (Split) ---
// Gunakan split untuk mengarahkan traffic:
// - 'wsLink' untuk subscriptions
// - 'httpLink' (dengan auth) untuk lainnya
const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink, // Ke sini jika subscription
      authLink.concat(httpLink) // Ke sini untuk query/mutation
    )
  : authLink.concat(httpLink); // Fallback jika SSR (wsLink null)

// --- Buat Client ---
const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}