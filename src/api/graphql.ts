export interface GraphQLPayload {
  name: string;
  operationId?: string;
  query?: string;
  variables: Record<string, any>;
}

export const executeGraphQL = async (tenant: string, apiKey: string, payload: GraphQLPayload) => {
  const baseUrl = tenant.startsWith('http') ? tenant : `https://${tenant}`;
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      operationName: payload.name,
      name: payload.name,
      operationId: payload.operationId,
      query: payload.query || null,
      variables: payload.variables
    })
  });

  if (!response.ok) {
    throw new Error(`GraphQL Error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL Execution Error: ${result.errors[0]?.message}`);
  }
  return result.data;
};
