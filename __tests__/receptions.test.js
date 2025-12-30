const supertest = require('supertest');
const createServer = require('../utils/server')

const app = createServer();

describe('records', () => {
    let token = ''
    beforeAll(async () => {
        const  payload = {login: "rastegaeva_mi@mail.ru", password: "Masha2002"}
        const response = await supertest(app).post('/api/user/login').send(payload)
        token = response.body.token
    })

    describe('get records route', () => {
        describe('given no auth token', () => {
            it('should return no auth error', async () => {
                await supertest(app)
                    .get('/api/receptions/list').expect(401)
            })
        })
        describe('given no parameters', () => {
            it('should return all receptions list', async () => {
                const response = await supertest(app)
                    .get('/api/receptions/list')
                    .set('Authorization', `Bearer ${token}`)
                    .expect(200)
            })
        })
    })
})