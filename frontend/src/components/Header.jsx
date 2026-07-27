import { Menu, Search, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Header({
  openMenu,
  go,
}) {

  const { user } = useAuth();

  return (

<header className="topbar">

<div
className="brand"
onClick={() => go("/")}
>

Rentify
<span>.ng</span>

</div>

<div className="top-icons">

<button
className="icon"
onClick={() => go("/listings")}
>

<Search size={20} />

</button>

<button
className="icon"
onClick={() =>
user
? go(
user.role === "owner"
? "/owner"
: "/dashboard"
)
: go("/auth")
}
>

<User size={20} />

</button>

<button
className="icon"
onClick={openMenu}
>

<Menu size={22} />

</button>

</div>

</header>

  );

}