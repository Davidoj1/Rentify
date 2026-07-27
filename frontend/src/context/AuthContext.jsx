import {
  createContext,
  useContext,
  useState,
} from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    JSON.parse(
      localStorage.getItem("rentify_user") || "null"
    )
  );

  const login = (user, token) => {
    localStorage.setItem(
      "rentify_user",
      JSON.stringify(user)
    );

    localStorage.setItem(
      "rentify_token",
      token
    );

    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("rentify_user");
    localStorage.removeItem("rentify_token");

    setUser(null);

    location.hash = "#/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}