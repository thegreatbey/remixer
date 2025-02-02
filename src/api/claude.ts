import axios from 'axios'

const CLAUDE_API_URL = process.env.REACT_APP_CLAUDE_API_URL
const CLAUDE_API_KEY = process.env.REACT_APP_CLAUDE_API_KEY

if (!CLAUDE_API_KEY) {
  console.warn('Missing CLAUDE_API_KEY environment variable')
}

const claudeApi = axios.create({
  baseURL: CLAUDE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLAUDE_API_KEY}`
  }
})

export const remixContent = async (content: string) => {
  try {
    const response = await claudeApi.post('/v1/messages', {
      model: 'claude-3-haiku-20240307',


      messages: [{
        role: 'user',
        content: `Please remix the following content in a creative way: ${content}`
      }],
      max_tokens: 1024
    })
    
    return response.data.content[0].text
  } catch (error) {
    console.error('Error calling Claude API:', error)
    throw error
  }
}

export default claudeApi 