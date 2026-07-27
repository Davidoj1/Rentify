import { useState } from "react";

import {

LogOut,

X,

} from "lucide-react";

import Header from "./Header";

import Footer from "./layout/Footer";

import { useAuth } from "../context/AuthContext";

export default function Layout({

children,

go,

}) {

const { user, logout } = useAuth();

const [open, setOpen] = useState(false);

const nav = (path) => {

go(path);

setOpen(false);

};

return (

<>

<Header

go={go}

openMenu={() => setOpen(true)}

/>

<div className="beta">

🚧 Rentify is currently in Private Beta.

Please complete all transactions through Rentify.

</div>

{

open && (

<div className="drawer">

<div

className="shade"

onClick={() => setOpen(false)}

/>

<nav className="panel">

<button

className="close"

onClick={() => setOpen(false)}

>

<X />

</button>

<h2>

Rentify

</h2>

<a onClick={() => nav("/")}>

Home

</a>

<a onClick={() => nav("/listings")}>

Explore Listings

</a>

{user?.role === "owner" && (

<a onClick={() => nav("/owner")}>

Owner Dashboard

</a>

)}

{user && (

<a onClick={() => nav("/dashboard")}>

My Bookings

</a>

)}

<a onClick={() => nav("/create")}>

List an Item

</a>

<a onClick={() => nav("/terms")}>

Terms

</a>

<a onClick={() => nav("/safety")}>

Safety

</a>

{

user

?

<button

className="ghost"

onClick={logout}

>

<LogOut size={16}/>

Logout

</button>

:

<button

onClick={() => nav("/auth")}

>

Sign In

</button>

}

</nav>

</div>

)

}

<main>

{children}

</main>

<Footer go={go} />

</>

);

}