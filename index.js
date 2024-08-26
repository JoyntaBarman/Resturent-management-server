const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const secretKey = process.env.SECRET_KEY;
const stripe_secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(stripe_secret_key);

// middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(bodyParser.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.swu9d.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vxct1yk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db('BistroDB');

    const menuCollection = database.collection('menu');
    const reviewCollection = database.collection('review');
    const cartCollection = database.collection('cart');
    const userCollection = database.collection('user');
    const messageCollection = database.collection('message');

    const verifyToken = (req, res, next) => {
      const token = req?.headers?.authorization.split(' ')[1];

      if (!token) {
        return res.status(403).send({ message: 'No token provided.' });
      }
      jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Failed to authenticate token.' });
        }
        req.decoded = decoded;
        next();
      });
    };

    const isAdmin = async (req, res, next) => {
      const email = req?.decoded?.email;
      const findUser = await userCollection.findOne({ email: email });
      if (!findUser?.role === 'Admin') {
        return res.status(401).send({ message: 'Admin denyed' });
      }
      next();
    };

    app.get('/menu', async (req, res) => {
      const menuData = await menuCollection.find().toArray();
      res.send(menuData);
    });

    app.get('/menu/:category', async (req, res) => {
      const category = req.params.category;

      const menuData = await menuCollection
        .find({ category: category })
        .toArray();
      res.send(menuData);
    });

    app.get('/review', async (req, res) => {
      const reviewData = await reviewCollection.find().toArray();
      res.send(reviewData);
    });

    app.get('/jwt', (req, res) => {
      const email = req?.query?.email;
      const token = jwt.sign({ email }, secretKey, { expiresIn: '24h' });
      res.status(200).send({ token });
    });

    app.get('/cart', verifyToken, async (req, res) => {
      const email = req?.decoded?.email;
      const addedCart = await cartCollection.findOne({ email: email });
      const productIdArr = addedCart?.productIds;

      if (productIdArr) {
        const cart = await Promise.all(
          productIdArr.map(async (item) => {
            const menuItem = await menuCollection.findOne({ _id: item });
            return menuItem;
          })
        );
        return res.status(200).send([...new Set(cart)]);
      } else {
        return res.status(200).send([]);
      }
    });

    app.get('/isadmin', verifyToken, async (req, res) => {
      const email = req?.decoded?.email;
      // const email = 'amiandtumi@gmail.com'
      if (email) {
        const result = await userCollection.findOne({ email: email });
        const checkAdmin = result.role === 'Admin';
        return res.status(200).json({ admin: checkAdmin });
      }
      return res.status(200).json({ admin: false });
    });

    app.post('/user', async (req, res, next) => {
      try {
        const user = req?.body;
        const email = req?.body?.email;
        const filter = await userCollection.findOne({ email: email });

        if (!filter) {
          const result = await userCollection.insertOne(user);
          return res.status(200).send(result);
        }
        return res.status(401).send({ message: 'user Already axixt' });
      } catch {
        return res.status(401).send({ message: 'user create faild.' });
      }
    });

    app.post('/sendmessage', verifyToken, async (req, res) => {
      const message = req?.body;
      message.userEmail = req?.decoded?.email;
      const result = await messageCollection.insertOne(req?.body);
      res.status(200).send({ message: 'Successful post data' });
    });

    app.post('/cart', verifyToken, async (req, res, next) => {
      const existCart = await cartCollection.findOne({
        email: req?.decoded?.email,
      });
      if (existCart) {
        const filter = { email: existCart?.email };
        const existProduct = existCart?.productIds.find(
          (item) => item === req?.body?.productId
        );

        if (!existProduct) {
          const updateProducts = {
            $push: {
              productIds: req?.body?.productId,
            },
          };
          const result = await cartCollection.updateOne(filter, updateProducts);
          res.send(result);
        } else {
          res.status(200).send('Product already set!');
        }
      } else {
        const cart = {
          email: req?.decoded?.email,
          productIds: [req?.body?.productId],
        };
        const result = await cartCollection.insertOne(cart);
        
        res.send(result);
      }
    });

    app.post('/create-intent', async (req, res) => {
      const intent = await stripe.paymentIntents.create({
        customer: customer.id,
        amount: 1099,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
      });
      res.json({ client_secret: intent.client_secret });
    });

    app.delete('/cart/:id', verifyToken, async (req, res) => {
      const id = req?.params?.id;
      const email = req?.decoded?.email;
      const filter = { email: email };
      const updateDoc = {
        $pull: {
          productIds: {
            $eq: id,
          },
        },
      };
      const result = await cartCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Not found.');
});

app.listen(port, () => {
  console.log(`ema john server is running on port: ${port}`);
});
