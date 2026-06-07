const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messages = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const sendButton = document.querySelector("#send-button");
const activePersona = document.querySelector("#active-persona");
const sidebar = document.querySelector("#sidebar");
const scrim = document.querySelector("#scrim");
const STORAGE_KEY = "delta-chat-state-v1";

let persona = "guide";
let history = [];

const personaNames = {
  guide: "Class Clown",
  python: "Python Tutor",
  creative: "Creative Partner",
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ persona, history }));
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.history) || !personaNames[saved.persona]) return;
    persona = saved.persona;
    history = saved.history.filter((item) => item && ["user", "model"].includes(item.role) && typeof item.text === "string");
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function renderInlineMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function renderMarkdown(value) {
  const codeBlocks = [];
  const escaped = escapeHtml(value).replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, language, code) => {
    const token = `%%CODEBLOCK${codeBlocks.length}%%`;
    codeBlocks.push(`<pre><code data-language="${language || "text"}">${code.trim()}</code></pre>`);
    return token;
  });

  const lines = escaped.split("\n");
  const output = [];
  let listType = null;

  function closeList() {
    if (listType) output.push(`</${listType}>`);
    listType = null;
  }

  lines.forEach((line) => {
    if (/^%%CODEBLOCK\d+%%$/.test(line.trim())) {
      closeList();
      output.push(line.trim());
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length + 2;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
      return;
    }

    closeList();
    if (line.trim()) output.push(`<p>${renderInlineMarkdown(line)}</p>`);
  });

  closeList();
  return output.join("").replace(/%%CODEBLOCK(\d+)%%/g, (_, index) => codeBlocks[Number(index)]);
}

function addMessage(role, text, extraClass = "") {
  const row = document.createElement("div");
  row.className = `message ${role} ${extraClass}`.trim();
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  if (role === "model" && extraClass !== "error") {
    bubble.classList.add("markdown");
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }
  row.appendChild(bubble);
  messages.appendChild(row);
  row.scrollIntoView({ behavior: "smooth", block: "end" });
  return row;
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "message model";
  row.innerHTML = '<div class="message-bubble"><span class="typing"><i></i><i></i><i></i></span></div>';
  messages.appendChild(row);
  row.scrollIntoView({ behavior: "smooth", block: "end" });
  return row;
}

function resetChat() {
  history = [];
  localStorage.removeItem(STORAGE_KEY);
  messages.replaceChildren();
  welcome.hidden = false;
  input.value = "";
  input.focus();
}

async function sendMessage(text) {
  const message = text.trim();
  if (!message || sendButton.disabled) return;

  welcome.hidden = true;
  addMessage("user", message);
  input.value = "";
  input.style.height = "auto";
  sendButton.disabled = true;
  const typing = addTyping();

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, persona, history }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "The request failed.");
    }

    typing.remove();
    const replyRow = addMessage("model", "");
    const replyBubble = replyRow.querySelector(".message-bubble");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let reply = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      reply += decoder.decode(value, { stream: true });
      replyBubble.innerHTML = renderMarkdown(reply);
      replyRow.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    if (!reply.trim()) throw new Error("Gemini returned an empty response.");
    history.push({ role: "user", text: message }, { role: "model", text: reply });
    saveState();
  } catch (error) {
    typing.remove();
    addMessage("model", error.message, "error");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});

document.querySelectorAll("[data-persona]").forEach((button) => {
  button.addEventListener("click", () => {
    persona = button.dataset.persona;
    document.querySelector(".persona.active").classList.remove("active");
    button.classList.add("active");
    activePersona.textContent = personaNames[persona];
    resetChat();
    saveState();
    sidebar.classList.remove("open");
    scrim.classList.remove("show");
  });
});

document.querySelector("#new-chat").addEventListener("click", resetChat);
document.querySelector("#clear-button").addEventListener("click", resetChat);
document.querySelector("#menu-button").addEventListener("click", () => {
  sidebar.classList.add("open");
  scrim.classList.add("show");
});
scrim.addEventListener("click", () => {
  sidebar.classList.remove("open");
  scrim.classList.remove("show");
});

restoreState();
document.querySelectorAll("[data-persona]").forEach((button) => {
  button.classList.toggle("active", button.dataset.persona === persona);
});
activePersona.textContent = personaNames[persona];
if (history.length) {
  welcome.hidden = true;
  history.forEach((item) => addMessage(item.role, item.text));
}
