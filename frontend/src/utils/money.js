export function formatMoney(amount){

    return new Intl.NumberFormat(

        "en-NG",

        {

            style:"currency",

            currency:"NGN",

            maximumFractionDigits:0

        }

    ).format(amount || 0);

}