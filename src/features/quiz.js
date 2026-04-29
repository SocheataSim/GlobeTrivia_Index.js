import { showField, hideField, shuffle, decodeHTML } from "../core/utils.js";
import { saveScore } from "./leaderboard.js";
import { authReady, getCurrentUser } from "../core/state.js";
import { openAuthModal } from "./auth.js";

//  STATE
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizListenersBound = false;

function getOrCreateQuizLoginGate() {
  const setup = document.getElementById("quiz-setup");
  if (!setup) return null;

  let container = document.getElementById("quiz-login-gate");
  if (!container) {
    container = document.createElement("div");
    container.id = "quiz-login-gate";
    const setupCard = setup.querySelector(".quiz-setup-card");
    if (setupCard) {
      setupCard.insertAdjacentElement("afterend", container);
    } else {
      setup.appendChild(container);
    }
  }

  return container;
}

//  AUTH GATE UI  (mirrors Notes page)
function renderQuizLogin() {
  const setup = document.getElementById("quiz-setup");
  if (setup) setup.style.display = "flex";
  setup?.querySelector(".quiz-setup-card")?.classList.add("is-hidden");
  document.getElementById("quiz-active")?.classList.add("is-hidden");
  document.getElementById("quiz-results")?.classList.add("is-hidden");

  const container = getOrCreateQuizLoginGate();
  if (!container) return;

  container.style.display = "block";
  container.innerHTML = `
    <div class="empty-state quiz-login-empty-state">
      <h3>Sign in to access the Quiz</h3>
      <p>Test your geography knowledge - sign in to start playing.</p>
      <button class="btn btn-primary empty-state-action" id="quiz-login-btn">Sign In Now</button>
    </div>
  `;
  document.getElementById("quiz-login-btn")?.addEventListener("click", () => {
    openAuthModal("login");
  });
}

function renderQuizSetup() {
  const gate = getOrCreateQuizLoginGate();
  if (gate) gate.style.display = "none";

  const setup = document.getElementById("quiz-setup");
  if (setup) setup.style.display = "flex";
  setup?.querySelector(".quiz-setup-card")?.classList.remove("is-hidden");
}

export async function initQuiz() {
  await authReady;


  if (!getCurrentUser()) {
    renderQuizLogin();
  } else {
    renderQuizSetup();
  }

  if (quizListenersBound) return;
  quizListenersBound = true;

  document
    .getElementById("start-quiz-btn")
    .addEventListener("click", startQuiz);
  document.getElementById("next-btn").addEventListener("click", nextQuestion);
  document.getElementById("finish-btn").addEventListener("click", finishQuiz);
  document.getElementById("play-again-btn").addEventListener("click", () => {
    document.getElementById("quiz-results").classList.add("is-hidden");
    document.getElementById("quiz-active").classList.remove("is-hidden");
    quizIndex = 0;
    quizScore = 0;
    document.getElementById("q-score-live").textContent = "0";
    showQuestion();
  });
  document
    .getElementById("change-settings-btn")
    .addEventListener("click", () => {
      document.getElementById("quiz-results").classList.add("is-hidden");
      document.getElementById("quiz-active").classList.add("is-hidden");
      if (getCurrentUser()) {
        renderQuizSetup();
      } else {
        renderQuizLogin();
      }
    });
}

//  START
async function startQuiz() {
  if (!getCurrentUser()) {
    window.location.hash = "#home";
    openAuthModal("login");
    try {
      const { showToast } = await import("../core/utils.js");
      showToast("Your session expired. Please sign in again.", "info");
    } catch {
      console.info("Quiz requires authentication.");
    }
    return;
  }

  const count = document.getElementById("quiz-count").value;
  const diff = document.getElementById("quiz-diff").value;
  hideField("quiz-setup-error");
  document.getElementById("quiz-setup").style.display = "none";
  document.getElementById("quiz-results").classList.add("is-hidden");
  document.getElementById("quiz-active").classList.remove("is-hidden");
  document.getElementById("q-options").innerHTML =
    `<div class="loading-block"><div class="spinner"></div></div>`;
  document.getElementById("q-text").textContent = "Loading questions…";
  document.getElementById("next-btn").classList.add("is-hidden");
  document.getElementById("finish-btn").classList.add("is-hidden");
  document.getElementById("q-feedback").className = "quiz-feedback is-hidden";

  try {
    let url = `https://opentdb.com/api.php?amount=${count}&category=22&type=multiple`;
    if (diff) url += `&difficulty=${diff}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Network error: ${res.status}`);
    const data = await res.json();
    if (data.response_code !== 0 || !data.results.length)
      throw new Error('No questions');

    quizQuestions = data.results.map((q) => ({
      question: decodeHTML(q.question),
      correct: decodeHTML(q.correct_answer),
      options: shuffle(
        [q.correct_answer, ...q.incorrect_answers].map(decodeHTML),
      ),
      difficulty: q.difficulty,
      category: q.category,
    }));
    quizIndex = 0;
    quizScore = 0;
    document.getElementById("q-score-live").textContent = "0";
    showQuestion();
  } catch (e) {
    console.error("Quiz load error:", e);
    document.getElementById("quiz-active").classList.add("is-hidden");
    document.getElementById("quiz-setup").style.display = "flex";
    showField(
      "quiz-setup-error",
      "❌ Failed to load questions. The trivia API may be rate-limited. Please try again.",
    );
  }
}

//  SHOW QUESTION
function showQuestion() {
  const q = quizQuestions[quizIndex];
  quizAnswered = false;

  document.getElementById("q-num").textContent =
    `Question ${quizIndex + 1} of ${quizQuestions.length}`;
  const badge = document.getElementById("q-diff-badge");
  badge.textContent = "🏷️ " + q.difficulty.toUpperCase();
  badge.classList.remove("is-hidden");
  document.getElementById("q-text").innerHTML = q.question;
  document.getElementById("quiz-progress-bar").style.width =
    (quizIndex / quizQuestions.length) * 100 + "%";
  document.getElementById("q-feedback").className = "quiz-feedback is-hidden";
  document.getElementById("next-btn").classList.add("is-hidden");
  document.getElementById("finish-btn").classList.add("is-hidden");

  const opts = document.getElementById("q-options");
  opts.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.innerHTML = `<span class="quiz-option-key">${"ABCD"[i]}.</span> ${opt}`;
    btn.addEventListener("click", () => answerQuestion(opt, btn));
    opts.appendChild(btn);
  });
}

//  ANSWER
function answerQuestion(selected, btn) {
  if (quizAnswered) return;
  quizAnswered = true;
  const q = quizQuestions[quizIndex];
  const correct = q.correct;
  const isRight = selected === correct;
  if (isRight) quizScore++;
  document.getElementById("q-score-live").textContent = quizScore;

  document.querySelectorAll("#q-options button").forEach((b) => {
    b.disabled = true;
    b.classList.add("quiz-option-disabled");
    if (b.textContent.includes(correct)) {
      b.classList.add("quiz-option-correct");
    }
    if (b === btn && !isRight) {
      b.classList.add("quiz-option-wrong");
    }
  });

  const fb = document.getElementById("q-feedback");
  fb.className = "quiz-feedback";
  if (isRight) {
    fb.classList.add("quiz-feedback-success");
    fb.textContent = "✅ Correct!";
  } else {
    fb.classList.add("quiz-feedback-error");
    fb.textContent = `❌ The correct answer was: ${correct}`;
  }

  const isLast = quizIndex === quizQuestions.length - 1;
  if (isLast)
    document.getElementById("finish-btn").classList.remove("is-hidden");
  else document.getElementById("next-btn").classList.remove("is-hidden");
}

// ═══════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════
function nextQuestion() {
  quizIndex++;
  showQuestion();
}

async function finishQuiz() {
  document.getElementById("quiz-active").classList.add("is-hidden");
  document.getElementById("quiz-results").classList.remove("is-hidden");

  const total = quizQuestions.length;
  const wrong = total - quizScore;
  const pct = Math.round((quizScore / total) * 100);

  document.getElementById("res-score").textContent = `${quizScore}/${total}`;
  document.getElementById("res-correct").textContent = quizScore;
  document.getElementById("res-wrong").textContent = wrong;
  document.getElementById("res-pct").textContent = pct + "%";

  const msgs = [
    [90, "🏆 Outstanding! You're a geography genius!"],
    [70, "🌟 Great job! Strong geographical knowledge!"],
    [50, "📚 Good effort! Keep exploring the world."],
    [0, "🌍 Keep learning — the world is fascinating!"],
  ];
  document.getElementById("res-msg").textContent = msgs.find(
    (m) => pct >= m[0],
  )[1];

  await saveScore({
    score: quizScore,
    total,
    pct,
    diff: document.getElementById("quiz-diff").value,
    date: new Date().toLocaleDateString(),
  });
}
