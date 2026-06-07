const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messages = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const sendButton = document.querySelector("#send-button");
const activePersona = document.querySelector("#active-persona");
const sidebar = document.querySelector("#sidebar");
const scrim = document.querySelector("#scrim");

let persona = "guide";
let history = [];

const personaNames = {
  guide: "Class Clown",
  python: "Python Tutor",
  creative: "Creative Partner",
};

function addMessage(role, text, extraClass = "") {
  const row = document.createElement("div");
  row.className = `message ${role} ${extraClass}`.trim();
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;
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
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, persona, history }),
    });
    const data = await response.json();
    typing.remove();
    if (!response.ok) throw new Error(data.error || "The request failed.");
    addMessage("model", data.reply);
    history.push({ role: "user", text: message }, { role: "model", text: data.reply });
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
