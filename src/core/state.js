// const state = {
//   currentUser: null,
//   currentCountry: null
// };

// export function getCurrentUser() {
//   return state.currentUser;
// }

// export function setCurrentUser(user) {
//   state.currentUser = user;
// }

// export function getCurrentCountry() {
//   return state.currentCountry;
// }

// export function setCurrentCountry(country) {
//   state.currentCountry = country;
// }
const state = {
  currentUser: null,
  currentCountry: null
};

// Resolves once Firebase Auth has confirmed the initial session (logged in or not).
// Any section that depends on auth should await this before reading currentUser.
let resolveAuthReady;
export const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

export function getCurrentUser() {
  return state.currentUser;
}

export function setCurrentUser(user) {
  state.currentUser = user;
  resolveAuthReady(); // Signal that auth state is now known
}

export function getCurrentCountry() {
  return state.currentCountry;
}

export function setCurrentCountry(country) {
  state.currentCountry = country;
}