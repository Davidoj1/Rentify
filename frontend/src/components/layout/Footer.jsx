export default function Footer({ go }) {

return (

<footer>

<b>Rentify © 2026</b>

<p>
Connecting renters and owners across Nigeria.
</p>

<p>

support@rentify.ng

</p>

<div className="footer-links">

<button
className="footer-link"
onClick={() => go("/terms")}
>

Terms

</button>

<button
className="footer-link"
onClick={() => go("/safety")}
>

Safety

</button>

</div>

</footer>

);

}