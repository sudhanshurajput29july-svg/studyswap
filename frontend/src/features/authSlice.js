import { createSlice } from '@reduxjs/toolkit';

const token = localStorage.getItem('token') || null;
let user = null;
try {
  const storedUser = localStorage.getItem('user');
  if (storedUser) user = JSON.parse(storedUser);
} catch (e) {
  console.error('Failed to parse stored user:', e);
}

const initialState = {
  user,
  token,
  isAuthenticated: !!token,
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    authSuccess: (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    authFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateProfileSuccess: (state, action) => {
      state.user = {
        ...state.user,
        profile: action.payload.profile,
        name: action.payload.name || state.user.name,
        role: action.payload.role || state.user.role,
        reputation: action.payload.reputation || state.user.reputation
      };
      localStorage.setItem('user', JSON.stringify(state.user));
    },
    logoutSuccess: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const {
  authStart,
  authSuccess,
  authFailure,
  updateProfileSuccess,
  logoutSuccess,
  clearError
} = authSlice.actions;

export default authSlice.reducer;
