const express = require("express");
const router = express.Router();
const pool = require("../db");

// регистрация
router.post("/register", async (req, res) => {

    const { name, login, email, password, group } = req.body;

    try {

        const result = await pool.query(
            `INSERT INTO users (name, login, email, password, "group")
             VALUES ($1,$2,$3,$4,$5)
             RETURNING *`,
            [name, login, email, password, group]
        );

        res.json(result.rows[0]);

    } catch (err) {
        res.status(500).json(err);
    }
});

// авторизация
router.post("/login", async (req, res) => {

    const { login, password } = req.body;

    const result = await pool.query(
        `SELECT * FROM users WHERE login=$1 AND password=$2`,
        [login, password]
    );

    if(result.rows.length === 0){
        return res.status(401).json({error:"Неверный логин"});
    }

    res.json(result.rows[0]);
});

module.exports = router;