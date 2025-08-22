const express = require("express");
const session = require("express-session");
const { MongoClient } = require("mongodb");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.urlencoded({ extended: true }));

// session middleware
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// MongoDB
const client = new MongoClient(process.env.MONGO_URI);
let sessionsCol;

async function initDB() {
  await client.connect();
  const db = client.db("sessionDB");
  sessionsCol = db.collection("sessions");
}
initDB();

// Simple auth
const USER = "BloxMartAdmin";
const PASS = "ft78U8T8-ynQW9";

function isAuth(req, res, next) {
  if (req.session.auth) return next();
  res.redirect("/login");
}

// Login
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === USER && password === PASS) {
    req.session.auth = true;
    return res.redirect("/");
  }
  res.send(
    "<script>alert('Invalid credentials'); window.location='/login'</script>"
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Dashboard
app.get("/", isAuth, async (req, res) => {
  const sessions = await sessionsCol.find({}).toArray();
  res.render("dashboard.ejs", { sessions });
});

// Add new session
app.post("/add", isAuth, async (req, res) => {
  let { id, type, host, cohosts, status } = req.body;
  const cohostsArr = cohosts
    ? cohosts
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  if (!host || host.trim() === "") {
    if (cohostsArr.length === 0) {
      return res.send(
        "<script>alert('❌ You cannot add a session without a Host or Co-Host.'); window.history.back();</script>"
      );
    }
  }

  const exists = await sessionsCol.findOne({ id: id });
  if (exists) {
    return res.send(
      "<script>alert('❌ Session ID already exists.'); window.history.back();</script>"
    );
  }

  await sessionsCol.insertOne({ id, type, host, cohosts: cohostsArr, status });
  res.redirect("/");
});

// Update session
app.post("/update/:id", isAuth, async (req, res) => {
  const id = req.params.id;
  let { status, host, cohosts } = req.body;
  const cohostsArr = cohosts
    ? cohosts
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  const sessionDoc = await sessionsCol.findOne({ id });
  if (!sessionDoc) return res.redirect("/");

  // Host validation
  if (!host || host.trim() === "") {
    if (cohostsArr.length === 0) {
      return res.send(
        "<script>alert('❌ You cannot remove the host without a Co-Host.'); window.history.back();</script>"
      );
    }
  }

  await sessionsCol.updateOne(
    { id: id },
    { $set: { status: status, host: host, cohosts: cohostsArr } }
  );
  res.redirect("/");
});

// Delete session
app.post("/delete/:id", isAuth, async (req, res) => {
  const id = req.params.id;
  await sessionsCol.deleteOne({ id });
  res.redirect("/");
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.listen(3000, () => console.log("Server running on port 3000"));
