
const state = {
  currentUser: null,
  currentCountry: null
};

let resolveAuthReady;
export const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

export function getCurrentUser() {
  return state.currentUser;
}

export function setCurrentUser(user) {
  state.currentUser = user;
  resolveAuthReady(); 
}

export function getCurrentCountry() {
  return state.currentCountry;
}

export function setCurrentCountry(country) {
  state.currentCountry = country;
}