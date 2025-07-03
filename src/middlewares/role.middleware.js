export const checkRole = (roles) => {
    return (req, res, next) => {
      const userRole = req.user?.role?.name; // populate phải có tên role
  
      if (!userRole || !roles.includes(userRole)) {
        return res.status(403).json({ msg: 'Bạn không có quyền truy cập.' });
      }
  
      next();
    };
  };