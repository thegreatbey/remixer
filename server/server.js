import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/remix', async (req, res) => {
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', 
      {
        messages: [{ role: 'user', content: req.body.text }],
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    res.json(response.data.content[0].text);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to remix content' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
