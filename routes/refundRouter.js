const router=require('express').Router();
const auth=require('../middleware/authMiddleware');
const currentAdmin=require('../middleware/currentAdminMiddleware');
const service=require('../integrations/refunds/service');
const handle=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){if(!e.status)console.error('Refund request failed:',e.name);res.status(e.status||500).json({message:e.status?e.message:'Unable to update return request. Please try again.'});}};
router.use(auth,currentAdmin);
router.get('/',handle(req=>service.list(req.query)));
router.post('/:id/review',handle(req=>service.review(req.user.id,req.params.id,req.body)));
module.exports=router;
