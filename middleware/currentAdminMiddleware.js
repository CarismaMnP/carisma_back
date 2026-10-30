const {User} = require('../models/models');
module.exports = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {attributes:['id','role']});
    if (!user) return res.status(401).json({message:'Please sign in again'});
    if (user.role !== 'ADMINISTRATOR') return res.status(403).json({message:'Administrator access required'});
    res.set('Cache-Control','private, no-store');
    next();
  } catch (_) {res.status(503).json({message:'Please try again shortly'});}
};
