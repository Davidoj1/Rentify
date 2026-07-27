import ListingCard from "./ListingCard";

export default function ListingGrid({

    listings,

    onSelect

}){

    return(

        <div className="listing-grid">

            {

                listings.map(listing=>(

                    <ListingCard

                        key={listing._id || listing.id}

                        listing={listing}

                        onClick={()=>onSelect(listing)}

                    />

                ))

            }

        </div>

    );

}