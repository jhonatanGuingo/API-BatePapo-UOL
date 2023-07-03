import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import dayjs from "dayjs";

const app = express();

app.use(express.json());
app.use(cors());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect();
  console.log("MongoDB conectado!");
} catch (err) {
  (err) => console.log(err.message);
}

const db = mongoClient.db();

const userSchema = Joi.object({
  name: Joi.string().required(),
});
let time = dayjs().locale("pt-br").format("HH:mm:ss");
app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const participants = {
    name,
  };

  const userName = {
    name,
    lastStatus: Date.now(),
  };

  const bodyMessage = {
    from: name,
    to: 'Todos',
    text: 'entra na sala...',
    type: 'status',
    time
  }
  const validation = userSchema.validate(participants, { abortEarly: false });
  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const nameRepeat = await db
      .collection("participants")
      .findOne({ name: name });
    if (nameRepeat) return res.status(409).send("Esse usuário já existe!");
    await db.collection("participants").insertOne(userName);
    await db.collection("messages").insertOne(bodyMessage);
    res.sendStatus(201);
    console.log(bodyMessage);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

app.get("/participants", async(req, res) => {
    try {
        const participantes = await db.collection("participants").find().toArray();
        res.send(participantes)
    } catch(err){
        return res.status(500).send(err.message);
    }
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
