const categories=[

    "All",
    "Apartments",
    "Vehicles",
    "Equipment",
    "Warehouses",
    "Electronics",
    "Event Items"

];

export default function CategoryTabs({

    selected,

    onSelect

}){

    return(

        <div className="category-tabs">

            {

                categories.map(category=>(

                    <button

                        key={category}

                        className={selected===category ? "active" : ""}

                        onClick={()=>onSelect(category)}

                    >

                        {category}

                    </button>

                ))

            }

        </div>

    );

}