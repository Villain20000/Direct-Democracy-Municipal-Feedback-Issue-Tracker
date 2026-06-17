import { Response } from 'express';

interface Client {
  res: Response;
  wardId?: string;
  role: string;
}

let clients: Client[] = [];

export const mapPushService = {
  addClient(res: Response, role: string, wardId?: string) {
    const client = { res, role, wardId };
    clients.push(client);

    // Keep connection alive with periodic heartbeats
    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 30000);

    res.on('close', () => {
      clearInterval(keepAlive);
      clients = clients.filter((c) => c !== client);
    });
  },

  broadcastNewIssue(issue: any) {
    const data = JSON.stringify({
      id: issue.id,
      title: issue.title,
      category: issue.category,
      status: issue.status,
      location: issue.location,
      latitude: issue.latitude ? parseFloat(issue.latitude.toString()) : null,
      longitude: issue.longitude ? parseFloat(issue.longitude.toString()) : null,
      wardId: issue.wardId,
    });

    for (const client of clients) {
      // If client is a ward representative with a ward constraint, filter notifications
      if (client.role === 'WARD_REP' && client.wardId && issue.wardId !== client.wardId) {
        continue;
      }
      client.res.write(`data: ${data}\n\n`);
    }
  },
};
