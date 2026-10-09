// Share the authentication context and provide a hook for components that need the current session or account actions.
import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
