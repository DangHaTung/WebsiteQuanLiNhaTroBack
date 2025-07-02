import express, { response } from "express";
import authRouter from './routers/auth.router'
import mongoose from "mongoose";

const app = express();

// your beautiful code...
mongoose.connect('mongodb://localhost:27017/duan_test')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));
app.use(express.json());
app.use(express.urlencoded())

app.use('/api', authRouter)


app.listen(3000, () => {
    console.log(`Server is running on port http://localhost:3000`);
});
