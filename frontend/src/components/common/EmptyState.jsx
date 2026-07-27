import { FaBoxOpen } from "react-icons/fa";

export default function EmptyState({

    title,

    message

}){

    return(

        <div className="empty-state">

            <FaBoxOpen size={70}/>

            <h2>{title}</h2>

            <p>{message}</p>

        </div>

    );

}