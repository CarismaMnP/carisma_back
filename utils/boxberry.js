const fetch = require('node-fetch');
const { Order, OrderProduct, Product } = require('../models/models');

class CdekClient {
  constructor() {
    this.token = "9f8e8badb92dd97d4aaaa653ee010909";
  }

  // Универсальный запрос
  async request(path, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...opts.headers
    };
    let url = `https://api.boxberry.ru/json.php?token=${this.token}${path}`
    if(opts.method === "POST"){
      url = `https://api.boxberry.ru/json.php`
    }
    const res = await fetch(url, {
      ...opts,
      headers
    });
    
    return res;
  }
  
  async getCity(cityName) {
    const res = await this.request(`&method=ListCities&CountryCode=643`, { method: 'GET' });
    if (!res.ok) throw new Error(res.statusText);
    const result = await res.json();
    const city = result.find((x) => x.Name.toLowerCase() === cityName.toLowerCase())
    return city ? city.Code : undefined
  }
  
  async getOffice(cityCode) {
    const res = await this.request(`&method=ListPoints&CountryCode=643&CityCode=${cityCode}`, { method: 'GET' });
    if (!res.ok) throw new Error(res.statusText);
    const result = await res.json();
    return result
  }
  
  async getTariffs(boxberryCityId, weight) {
    if(!boxberryCityId || boxberryCityId === ''){
      return []
    }

    const res = await this.request(``, { method: 'POST', body: JSON.stringify({
        "token": this.token,
        "method": "DeliveryCalculation",
        "SenderCityId": 68,
        "RecipientCityId": Number(boxberryCityId),
        "DeliveryType": 1,
        "TargetStart": "01639",
        "OrderSum": 0,
        "DeliverySum": 0,
        "PaySum": 0,
        "BoxSizes": [{"Width": 33, "Height": 23, "Depth": 10, "Weight": Number(weight)}],
        "UseShopSettings": 1
      })
     });
    if (!res.ok) throw new Error(res.statusText);
    const result = await res.json();
    const delivery = result['result']['DeliveryCosts']
    return delivery
  }
}

const BOXBERRY = new CdekClient()

module.exports = BOXBERRY;