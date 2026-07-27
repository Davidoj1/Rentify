import api from "./api";

export async function getListings({

    search="",

    category="All"

}){

    const params=new URLSearchParams();

    if(search)

        params.append("q",search);

    if(category!=="All")

        params.append("category",category);

    const response=await api.get(

        `/listings?${params.toString()}`

    );

    return response.data.listings;

}