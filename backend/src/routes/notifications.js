import { Router } from 'express';
import {
  dismissNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationsController.js';
import { verifyJWT } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

router.use(verifyJWT);
router.use(requireSuperAdmin);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:notificationId/read', markNotificationRead);
router.patch('/:notificationId/dismiss', dismissNotification);

export default router;
