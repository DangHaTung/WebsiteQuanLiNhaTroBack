import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

export const verifyToken = (req, res, next) => {
  try {
    // Lấy token từ header: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ msg: 'Không có token xác thực.' });
    }

    const token = authHeader.split(' ')[1];

    // Xác thực token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // req.user.userId sẵn sàng để sử dụng

    next();
  } catch (err) {
    console.error('❌ Lỗi xác thực JWT:', err.message);
    return res.status(403).json({ msg: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};
