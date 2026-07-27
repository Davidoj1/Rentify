import { Search, ShieldCheck } from "lucide-react";
import Listings from "./Listings";

export default function Home({ go }) {

const [q, setQ] = React.useState("");

const categories = [
"Apartments",
"Vehicles",
"Equipment",
"Warehouses",
"Event Items",
];

return (

<div>

<section className="hero">

<div>

<p className="eyebrow">

Nigeria's Smart Rental Marketplace

</p>

<h1>

Find it. Rent it. Love it.

</h1>

<p>

Rent apartments, cars, equipment and more across Nigeria.

</p>

<div className="searchbox">

<Search />

<input

value={q}

onChange={(e)=>setQ(e.target.value)}

placeholder="Search apartment, generator, Camry..."

 />

<button

onClick={()=>

go("/listings?q="+encodeURIComponent(q))

}

>

Search

</button>

</div>

</div>

<div className="hero-card">

<ShieldCheck />

<h3>Trusted Rentals</h3>

<p>

Secure bookings with transparent pricing.

</p>

</div>

</section>

<section className="section">

<h2>

Browse Categories

</h2>

<div className="catgrid">

{

categories.map(cat=>

<button

key={cat}

className="cat"

onClick={()=>go("/listings?category="+cat)}

>

{cat}

</button>

)

}

</div>

</section>

<Listings

embedded

go={go}

/>

</div>

);

}