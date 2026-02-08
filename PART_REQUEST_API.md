# Part Request API

## Submit Part Request

Sends a part request form to the business email (info@carismamp.com).

### Endpoint

```
POST /user/part-request
```

### Request Body

| Field             | Type   | Required | Description                                             |
| ----------------- | ------ | -------- | ------------------------------------------------------- |
| `make`            | string | No       | Car manufacturer (e.g., "BMW", "Audi", "Mercedes-Benz") |
| `model`           | string | No       | Car model (e.g., "330i", "A4", "C300")                  |
| `generation`      | string | No       | Car generation (e.g., "G20", "B9", "W205")              |
| `email`           | string | **Yes**  | Customer's email address for response                   |
| `partDescription` | string | No       | Description of the part being searched for              |

### Example Request

```json
{
  "make": "BMW",
  "model": "330i",
  "generation": "G20",
  "email": "customer@example.com",
  "partDescription": "Front bumper with PDC sensors"
}
```

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "Request submitted successfully"
}
```

### Error Responses

**Invalid Email (400 Bad Request)**

```json
{
  "message": "Please provide a valid email address"
}
```

**Server Error (500 Internal Server Error)**

```json
{
  "message": "Failed to submit request. Please try again later."
}
```

---

## Submit Client Message

Sends a client message form to the business email (info@carismamp.com).

### Endpoint

```
POST /api/public/user/client-message
```

### Request Body

| Field     | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| `name`    | string | **Yes**  | Client name          |
| `mail`    | string | **Yes**  | Client email address |
| `message` | string | **Yes**  | Client message       |

### Example Request

```json
{
  "name": "John Doe",
  "mail": "customer@example.com",
  "message": "Hi! I have a question about my order."
}
```

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

### Error Responses

**Invalid Email / Missing Fields**

```json
{
  "message": "Please provide a valid email address"
}
```

**Server Error (500 Internal Server Error)**

```json
{
  "message": "Failed to send message. Please try again later."
}
```
