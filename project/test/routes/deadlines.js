const express = require("express");
const router = express.Router();
const pool = require("../db");

// получить все дедлайны
router.get("/", async (req,res)=>{

    const result = await pool.query(`
        SELECT * FROM deadlines
        ORDER BY date_deadline
    `);

    res.json(result.rows);

});

// создать дедлайн
router.post("/", async (req,res)=>{

    const {
        subject,
        name,
        description,
        date_deadline,
        time_deadline,
        tags
    } = req.body;

    const result = await pool.query(`
        INSERT INTO deadlines
        (subject,name,description,date_deadline,time_deadline,tags)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
    `,
    [subject,name,description,date_deadline,time_deadline,tags]);

    res.json(result.rows[0]);

});

module.exports = router;