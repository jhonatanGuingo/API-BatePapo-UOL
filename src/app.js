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

const messageSchema = Joi.object({
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid("message", "private_message").required(),
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

  const bodyLogin = {
    from: name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time,
  };

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
    await db.collection("messages").insertOne(bodyLogin);
    res.sendStatus(201);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participantes = await db.collection("participants").find().toArray();
    res.send(participantes);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  const bodyMessage = {
    to,
    text,
    type,
  };
  const msg = {
    from: user,
    to,
    text,
    type,
    time,
  };

  const validation = messageSchema.validate(bodyMessage, { abortEarly: false });
  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const userExist = await db
      .collection("participants")
      .findOne({ name: user });
    if (!userExist) return res.status(422).send("Esse usuário não existe!");
    await db.collection("messages").insertOne(msg);
    res.sendStatus(201);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const {limit} = req.query;
  try {
    if (Number(limit) <= 0 || isNaN(limit)) {
      
        return res.sendStatus(422);
      } 
    const verifiMsg = await db
      .collection("messages")
      .find({
        $or: [
          { to: user },
          { from: user },
          { type: "Todos" },
          { type: "message" },
          { type: "status" },
        ]
      }).limit(Number(limit))
      .toArray();
    res.send(verifiMsg);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;
  if (!user) return res.sendStatus(404);
  try {
    const verifiUser = await db
      .collection("participants")
      .findOne({ name: user });
    if (!verifiUser) return res.status(409);
    await db.collection("participants").updateOne({name: user}, { $set: {lastStatus: Date.now()}});
    res.sendStatus(200)
  } catch(err) {
    return res.status(500).send(err.message);
  }
});

setInterval(async () =>{
    try{
        const userInactive = await db.collection("participants").find({ lastStatus: {$lt: Date.now() - 10000}}).toArray();
        userInactive.forEach(async (user) => {
            await db.collection("messages").insertOne({
                from: user.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: time
            });

            await db.collection("participants").deleteOne({_id: user._id});
        })
    }catch(err){
        return res.status(500).send(err.message);
    }
}, 15000)
const PORT = 5000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
