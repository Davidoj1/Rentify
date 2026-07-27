import { FaSearch } from "react-icons/fa";

export default function SearchBar({
    value,
    onChange,
    onSearch
}) {

    return (

        <div className="search-bar">

            <FaSearch className="search-icon"/>

            <input
                type="text"
                placeholder="Search apartments, cars, generators..."
                value={value}
                onChange={(e)=>onChange(e.target.value)}
                onKeyDown={(e)=>{

                    if(e.key==="Enter"){

                        onSearch();

                    }

                }}
            />

            <button onClick={onSearch}>

                Search

            </button>

        </div>

    );

}