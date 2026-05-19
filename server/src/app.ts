import express from 'express'
import cors from 'cors'
import aiRouter from './routes/ai.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api', aiRouter)

export default app
