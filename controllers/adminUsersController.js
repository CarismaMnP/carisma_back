const ApiError = require('../error/ApiError')
const jwt = require('jsonwebtoken')
const {User} = require('../models/models')

const generateJwt = (id, name, mail, role) => {
    return jwt.sign({id, name, mail, role}, process.env.SECRET_KEY,{expiresIn: '72h'})
}

class UsersController {
    async login(req, res, next) {
        const {mail, password} = req.body
        const user = await User.findOne({where: {mail}})
        if (!user){
            return next(ApiError.internal('Пользователь с таким логином не найден'))
        }
        let comparePassword = user.password === password;
        if (!comparePassword){
            return next(ApiError.internal('Указан неверный пароль'))
        }

        const token = generateJwt(user.id, user.name, user.mail, user.role)
        return res.json({token})
    }
 
    async check(req, res, next) {
        try {
            const user = await User.findOne({where: {id: req.user.id}})
            const token = generateJwt(user.id, user.name, user.mail, user.role)
            return res.json({token})
            
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async fetch(req, res) {
        try {return res.json(await require('../integrations/users/segments').list(req.query));}
        catch (e) {return thisError(res, e);}
    }

    async export(req, res) {
        try {
            const {format, fields, filters = {}, selection} = req.body;
            const {fail, exportRows} = require('../integrations/users/segments');
            if (!['csv','xlsx'].includes(format) || !['emails','contacts'].includes(fields)) fail('Invalid export format');
            if (!selection) fail('Select users to export');
            const rows = await exportRows(filters, selection);
            const result = await require('../integrations/users/export').makeExport(rows, format, fields);
            console.info('Customer export', {adminId:req.user.id,format,fields,selected:rows.length,exported:result.count});
            res.set('X-Content-Type-Options','nosniff');
            res.set('X-Export-Count', String(result.count));
            res.set('Access-Control-Expose-Headers', 'X-Export-Count, Content-Disposition');
            return res.attachment(`carisma-${fields}-${new Date().toISOString().slice(0,10)}.${format}`).type(result.type).send(result.buffer);
        } catch (e) {return thisError(res, e);}
    }

    async updateCategory(req, res) {
        try {
            const {integer, category, fail} = require('../integrations/users/segments');
            if (Object.keys(req.body).some(key => key !== 'purchasingAs') || !Object.hasOwn(req.body, 'purchasingAs')) fail('Only purchasingAs can be updated');
            const id = integer(req.params.id, 'user ID'), purchasingAs = category(req.body.purchasingAs);
            const [count] = await User.update({purchasingAs}, {where:{id}});
            if (!count) return res.status(404).json({message:'User not found'});
            console.info('Customer category updated', {adminId:req.user.id,userId:id,purchasingAs});
            return res.json({id,purchasingAs});
        } catch (e) {return thisError(res, e);}
    }
}
function thisError(res, e) {
    if (!e.status) console.error('Customer segmentation request failed:', e.name);
    return res.status(e.status || 500).json({message:e.status ? e.message : 'Unable to load customers. Please try again.'});
}
module.exports = new UsersController();
