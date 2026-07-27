import { useEffect, useState } from "react";

import SearchBar from "../components/listing/SearchBar";
import CategoryTabs from "../components/listing/CategoryTabs";
import ListingGrid from "../components/listing/ListingGrid";

import Loader from "../components/common/Loader";
import EmptyState from "../components/common/EmptyState";

import { getListings } from "../services/listingService";

import { useNavigate } from "react-router-dom";

export default function Listings() {

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);

    const [listings, setListings] = useState([]);

    const [search, setSearch] = useState("");

    const [category, setCategory] = useState("All");

    async function loadListings() {

        try {

            setLoading(true);

            const data = await getListings({

                search,

                category

            });

            setListings(data);

        }

        catch (err) {

            console.log(err);

            setListings([]);

        }

        finally {

            setLoading(false);

        }

    }

    useEffect(() => {

        loadListings();

    }, [category]);

    if (loading)

        return <Loader />;

    return (

        <div className="page-container">

            <div className="page-header">

                <h1>

                    Explore Rentals

                </h1>

                <p>

                    Discover trusted rentals across Nigeria.

                </p>

            </div>

            <SearchBar

                value={search}

                onChange={setSearch}

                onSearch={loadListings}

            />

            <CategoryTabs

                selected={category}

                onSelect={setCategory}

            />

            {

                listings.length > 0 ?

                    <ListingGrid

                        listings={listings}

                        onSelect={(listing)=>{

                            navigate(`/listing/${listing._id || listing.id}`);

                        }}

                    />

                    :

                    <EmptyState

                        title="No Listings Found"

                        message="Try another search or category."

                    />

            }

        </div>

    );

}