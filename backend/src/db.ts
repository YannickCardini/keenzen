import { CosmosClient, type Container } from '@azure/cosmos';

let client: CosmosClient | null = null;

function getClient(): CosmosClient {
    if (!client) {
        // L'émulateur Cosmos DB local utilise un certificat auto-signé
        if (process.env['NODE_ENV'] !== 'production') {
            process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
        }
        client = new CosmosClient(process.env['COSMOS_CONNECTION_STRING']!);
    }
    return client;
}

let usersContainer: Container | null = null;

export async function getUsersContainer(): Promise<Container> {
    if (usersContainer) return usersContainer;

    const { database } = await getClient().databases.createIfNotExists({ id: 'mercury-db' });
    const { container } = await database.containers.createIfNotExists({
        id: 'users',
        partitionKey: { paths: ['/id'] },
    });
    usersContainer = container;
    return container;
}
