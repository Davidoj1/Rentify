export async function shareListing(listing){

    const url=

        `${window.location.origin}/listing/${listing._id || listing.id}`;

    const text=

`${listing.title}

${listing.location}

${url}`;

    try{

        if(navigator.share){

            await navigator.share({

                title:listing.title,

                text,

                url

            });

        }

        else{

            await navigator.clipboard.writeText(url);

            alert("Listing link copied!");

        }

    }

    catch(err){

        console.log(err);

    }

}