export const checkRole = (roles) => {
    return (req, res, next) => {
      // Chấp nhận cả trường hợp role là string hoặc object có name
      const userRole = typeof req.user?.role === 'string' ? req.user.role : req.user?.role?.name;
  
      if (!userRole || !roles.includes(userRole)) {
        return res.status(403).json({ msg: 'Bạn không có quyền truy cập.' });
      }
  
      next();
    };
  };
  export const checkSuperAdmin = (req, res, next) => {
    // Chấp nhận cả string và object
    const userRole = typeof req.user?.role === 'string' ? req.user.role : req.user?.role?.name;
    if (userRole !== 'super_admin') {
      return res.status(403).json({ msg: 'Bạn không có quyền truy cập.' });
    }
    next();
  };