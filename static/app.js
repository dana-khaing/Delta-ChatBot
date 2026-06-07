const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messages = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const sendButton = document.querySelector("#send-button");
const activePersona = document.querySelector("#active-persona");
const sidebar = document.querySelector("#sidebar");
const scrim = document.querySelector("#scrim");
const humorSelect = document.querySelector("#humor-level");
const conversationList = document.querySelector("#conversation-list");
const STORAGE_KEY = "delta-chat-conversations-v2";
const LEGACY_STORAGE_KEY = "delta-chat-state-v1";

let persona = "guide";
let humor = "funny";
let history = [];
let conversations = [];
let activeConversationId = null;

const personaNames = {
  guide: "Class Clown",
  python: "Python Tutor",
  creative: "Creative Partner",
};

function conversationId() {
  return globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newConversation() {
  return {
    id: conversationId(),
    title: "New conversation",
    persona: "guide",
    humor: "funny",
    history: [],
    updatedAt: Date.now(),
  };
}

function syncActiveConversation() {
  const active = conversations.find((item) => item.id === activeConversationId);
  if (!active) return;
  active.persona = persona;
  active.humor = humor;
  active.history = history;
  active.updatedAt = Date.now();
  if (active.title === "New conversation" && history.length) {
    const firstUserMessage = history.find((item) => item.role === "user");
    if (firstUserMessage) active.title = firstUserMessage.text.slice(0, 34);
  }
}

function saveState() {
  syncActiveConversation();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeConversationId, conversations }));
  renderConversationList();
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.conversations) && saved.conversations.length) {
      conversations = saved.conversations;
      activeConversationId = saved.activeConversationId;
    } else {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
      const conversation = newConversation();
      if (legacy && Array.isArray(legacy.history)) {
        conversation.persona = personaNames[legacy.persona] ? legacy.persona : "guide";
        conversation.humor = ["serious", "funny", "maximum"].includes(legacy.humor) ? legacy.humor : "funny";
        conversation.history = legacy.history;
      }
      conversations = [conversation];
      activeConversationId = conversation.id;
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    conversations = [];
  }

  if (!conversations.some((item) => item.id === activeConversationId)) {
    activeConversationId = conversations[0]?.id;
  }
  if (!activeConversationId) {
    const conversation = newConversation();
    conversations = [conversation];
    activeConversationId = conversation.id;
  }
  loadConversation(activeConversationId, false);
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

function renderMessages() {
  messages.replaceChildren();
  welcome.hidden = !history.length;
  history.forEach((item) => addMessage(item.role, item.text));
}

function loadConversation(id, shouldSave = true) {
  if (shouldSave) syncActiveConversation();
  const selected = conversations.find((item) => item.id === id);
  if (!selected) return;
  activeConversationId = selected.id;
  persona = personaNames[selected.persona] ? selected.persona : "guide";
  humor = ["serious", "funny", "maximum"].includes(selected.humor) ? selected.humor : "funny";
  history = Array.isArray(selected.history) ? selected.history : [];
  document.querySelectorAll("[data-persona]").forEach((button) => {
    button.classList.toggle("active", button.dataset.persona === persona);
  });
  activePersona.textContent = personaNames[persona];
  humorSelect.value = humor;
  renderMessages();
  if (shouldSave) saveState();
}

function renderConversationList() {
  conversationList.replaceChildren();
  [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((conversation) => {
      const row = document.createElement("div");
      row.className = `saved-conversation ${conversation.id === activeConversationId ? "active" : ""}`;
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "conversation-open";
      openButton.textContent = conversation.title || "New conversation";
      openButton.addEventListener("click", () => loadConversation(conversation.id));

      const actions = document.createElement("div");
      actions.className = "conversation-actions";
      const renameButton = document.createElement("button");
      renameButton.type = "button";
      renameButton.title = "Rename conversation";
      renameButton.textContent = "✎";
      renameButton.addEventListener("click", () => {
        const title = prompt("Rename conversation", conversation.title);
        if (title?.trim()) {
          conversation.title = title.trim().slice(0, 50);
          saveState();
        }
      });
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.title = "Delete conversation";
      deleteButton.textContent = "×";
      deleteButton.addEventListener("click", () => {
        conversations = conversations.filter((item) => item.id !== conversation.id);
        if (!conversations.length) conversations.push(newConversation());
        if (activeConversationId === conversation.id) loadConversation(conversations[0].id, false);
        saveState();
      });
      actions.append(renameButton, deleteButton);
      row.append(openButton, actions);
      conversationList.appendChild(row);
    });
}

function resetChat() {
  history = [];
  const active = conversations.find((item) => item.id === activeConversationId);
  if (active) active.title = "New conversation";
  renderMessages();
  saveState();
  input.value = "";
  input.focus();
}

function startNewConversation() {
  syncActiveConversation();
  const conversation = newConversation();
  conversations.push(conversation);
  loadConversation(conversation.id);
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
      body: JSON.stringify({ message, persona, humor, history }),
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
    saveState();
    sidebar.classList.remove("open");
    scrim.classList.remove("show");
  });
});

document.querySelector("#new-chat").addEventListener("click", startNewConversation);
document.querySelector("#clear-button").addEventListener("click", resetChat);
document.querySelector("#menu-button").addEventListener("click", () => {
  sidebar.classList.add("open");
  scrim.classList.add("show");
});
scrim.addEventListener("click", () => {
  sidebar.classList.remove("open");
  scrim.classList.remove("show");
});
humorSelect.addEventListener("change", () => {
  humor = humorSelect.value;
  saveState();
});

restoreState();
saveState();
