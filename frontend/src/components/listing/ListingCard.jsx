import { Heart, MapPin, Share2, ShieldCheck, Star } from "react-icons/fa";
import { motion } from "framer-motion";
import { formatMoney } from "../../utils/money";
import { shareListing } from "../../utils/shareListing";
import { imageFallback } from "../../utils/imageFallback";

export default function ListingCard({
    listing,
    onClick
}) {

    const verified = listing.verified || false;

    return (

        <motion.div
            whileHover={{
                y: -6,
                transition: {
                    duration: .25
                }
            }}
            className="listing-card"
            onClick={onClick}
        >

            <div className="listing-image">

                <img
                    src={listing.images?.[0]}
                    alt={listing.title}
                    onError={imageFallback}
                />

                <button
                    className="favorite-btn"
                    onClick={(e)=>{
                        e.stopPropagation();
                    }}
                >
                    <Heart/>
                </button>

            </div>

            <div className="listing-content">

                <div className="listing-top">

                    <h3>{listing.title}</h3>

                    <button
                        className="share-btn"
                        onClick={(e)=>{
                            e.stopPropagation();
                            shareListing(listing);
                        }}
                    >
                        <Share2/>
                    </button>

                </div>

                <p className="listing-location">

                    <MapPin/>

                    {listing.location}

                </p>

                <div className="listing-rating">

                    <Star/>

                    <span>

                        {listing.rating || "New"}

                    </span>

                    {

                        verified &&

                        <span className="verified">

                            <ShieldCheck/>

                            Verified

                        </span>

                    }

                </div>

                <div className="listing-bottom">

                    <h2>

                        {formatMoney(listing.price)}

                    </h2>

                    <span>/day</span>

                </div>

            </div>

        </motion.div>

    );

}