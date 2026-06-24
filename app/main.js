import OpenAI from "openai"
import fs from "fs/promises"
import child_process from "child_process"

const readFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf8")
    return data
  } catch (error) {
    throw error
  }
}

const writeFile = async (filePath, content) => {
  try {
    fs.writeFile(filePath, content)
  } catch (error) {
    throw error
  }
}

const bashCommand = async (command) => {

    try{
    const output = child_process.execSync(command,{encoding:"utf-8"})
    return output
    }catch(err){
        console.log(err)
    }
}

const performTool = async (tool) => {
  const toolName = tool.function.name
  const argument = JSON.parse(tool.function.arguments)

  switch (toolName) {
    case "Read":
      const data = await readFile(argument.file_path)
      return data
      break
    case "Write":
      await writeFile(argument.file_path, argument.content)
      return "Successfully performed write operation."
      break
    case "Bash":
      const output = await bashCommand(argument.command)
      return output
    default:
      break
  }
}

async function main() {
  const [, , flag, prompt] = process.argv
  const apiKey = process.env.OPENROUTER_API_KEY
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set")
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required")
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  })

  let message = [{ role: "user", content: prompt }]

  while (1) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: message,
      tools: [
        {
          type: "function",
          function: {
            name: "Read",
            description: "Read and return the contents of a file",
            parameters: {
              type: "object",
              properties: {
                file_path: {
                  type: "string",
                  description: "The path to the file to read",
                },
              },
              required: ["file_path"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "Write",
            description: "Write content to a file",
            parameters: {
              type: "object",
              required: ["file_path", "content"],
              properties: {
                file_path: {
                  type: "string",
                  description: "The path of the file to write to",
                },
                content: {
                  type: "string",
                  description: "The content to write to the file",
                },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "Bash",
            description: "Execute a shell command",
            parameters: {
              type: "object",
              required: ["command"],
              properties: {
                command: {
                  type: "string",
                  description: "The command to execute",
                },
              },
            },
          },
        },
      ],
    })

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response")
    }

    message.push(response.choices[0].message)

    if (
      !response.choices[0].message.tool_calls ||
      response.choices[0].message.tool_calls < 0
    ) {
      console.log(response.choices[0].message.content)
      return
    }

    for (const tool of response.choices[0].message.tool_calls) {
      try {
        
      const result = await performTool(tool)


      message.push({
        role: "tool",
        tool_call_id: tool.id,
        content: result,
      })
      } catch (error) {
        console.log("Error", error) 
      }
    }
  }

  console.error("Logs from your program will appear here!")

}

main()
