import 'dotenv/config';
import { createServer } from 'http';
import next from 'next';
import cron from 'node-cron';
import { parse } from 'cookie';
import {
  setIO,
  getIO,
  setPresence,
  clearPresence,
  getProjectPresenceMap,
  setFieldLock,
  clearFieldLock,
  getProjectFieldLocks,
  setWorkspacePresence,
  clearWorkspacePresence,
  getWorkspacePresenceList,
} from './lib/socket';
import { verifyAccessToken } from './lib/auth';
import { prisma } from './lib/prisma';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  setIO(server);

  // Authenticate the socket during handshake using the same access_token
  // cookie the REST API relies on. This is the ONLY place a socket's userId
  // gets set — every join handler below must use socket.data.userId, never
  // a client-supplied id, or any authenticated user could join any other
  // user's/project's/workspace's room just by emitting the right event.
  getIO()?.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const cookies = cookieHeader ? parse(cookieHeader) : {};
      const token = cookies['access_token'];
      const decoded = token ? verifyAccessToken(token) : null;
      if (!decoded) {
        return next(new Error('Unauthorized'));
      }
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  getIO()?.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} (user ${socket.data.userId})`);

    socket.on('join:project', async (projectId: string) => {
      if (!projectId) return;
      const authedUserId = socket.data.userId;
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return;
      const member = await prisma.workspaceMember.findFirst({
        where: { userId: authedUserId, workspaceId: project.workspaceId },
      });
      if (!member) {
        console.log(`Socket ${socket.id} denied join for project ${projectId} (not a member)`);
        return;
      }
      socket.join(`project:${projectId}`);
      console.log(`Socket ${socket.id} joined project ${projectId}`);
    });

    socket.on('leave:project', (projectId: string) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
        console.log(`Socket ${socket.id} left project ${projectId}`);
      }
    });

    socket.on('join:user', (userId: string) => {
      const authedUserId = socket.data.userId;
      if (userId && userId === authedUserId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined user room ${userId}`);
      } else {
        console.log(`Socket ${socket.id} denied join for user room ${userId} (not self)`);
      }
    });

    socket.on('presence:set', (data: { projectId: string; taskId: string | null; userId: string }) => {
      setPresence(socket.id, { userId: data.userId, projectId: data.projectId, taskId: data.taskId });
      const presenceMap = getProjectPresenceMap(data.projectId);
      getIO()?.to(`project:${data.projectId}`).emit('presence:sync', presenceMap);
    });

        socket.on('field:focus', (data: {
      projectId: string;
      taskId: string;
      field: string;
      userId: string;
      userName: string;
      userAvatarColor: string;
    }) => {
      if (data.projectId && data.taskId && data.field && data.userId) {
        setFieldLock(socket.id, {
          userId: data.userId,
          userName: data.userName,
          userAvatarColor: data.userAvatarColor,
          projectId: data.projectId,
          taskId: data.taskId,
          field: data.field,
        });
        const lockMap = getProjectFieldLocks(data.projectId);
        getIO()?.to(`project:${data.projectId}`).emit('fieldlock:sync', lockMap);
      }
    });

    socket.on('workspace:status', async (data: {
      workspaceId: string;
      userId: string;
      userName: string;
      userAvatarColor: string;
      status: 'online' | 'viewing' | 'editing' | 'away';
    }) => {
      const authedUserId = socket.data.userId;
      if (!data.workspaceId || !data.userId || data.userId !== authedUserId) return;
      const member = await prisma.workspaceMember.findFirst({
        where: { userId: authedUserId, workspaceId: data.workspaceId },
      });
      if (!member) return;
      socket.join(`workspace:${data.workspaceId}`);
      setWorkspacePresence(socket.id, data);
      const list = getWorkspacePresenceList(data.workspaceId);
      getIO()?.to(`workspace:${data.workspaceId}`).emit('workspace:presence', list);
    });

    socket.on('field:blur', () => {
      
      const affectedProjectId = clearFieldLock(socket.id);
      if (affectedProjectId) {
        const lockMap = getProjectFieldLocks(affectedProjectId);
        getIO()?.to(`project:${affectedProjectId}`).emit('fieldlock:sync', lockMap);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      const affectedProjectId = clearPresence(socket.id);
      if (affectedProjectId) {
        const presenceMap = getProjectPresenceMap(affectedProjectId);
        getIO()?.to(`project:${affectedProjectId}`).emit('presence:sync', presenceMap);
      }
      const affectedFieldLockProjectId = clearFieldLock(socket.id);
      if (affectedFieldLockProjectId) {
        const lockMap = getProjectFieldLocks(affectedFieldLockProjectId);
        getIO()?.to(`project:${affectedFieldLockProjectId}`).emit('fieldlock:sync', lockMap);
      }
      const affectedWorkspaceId = clearWorkspacePresence(socket.id);
      if (affectedWorkspaceId) {
        const workspaceList = getWorkspacePresenceList(affectedWorkspaceId);
        getIO()?.to(`workspace:${affectedWorkspaceId}`).emit('workspace:presence', workspaceList);
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);

    // Daily digest — 9am server time, every day. Runs in this same
    // long-lived Node process (no separate worker needed at this scale).
    cron.schedule('0 9 * * *', () => {
  import('./jobs/dailyDigest')
    .then(({ sendDailyDigest }) => sendDailyDigest())
    .catch((err) => console.error('[dailyDigest] failed:', err));
});
});

});


