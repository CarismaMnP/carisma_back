const nodemailer = require('nodemailer');

class MailSending {

    DiamartLanding(name, mail){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `Diamart <hello@clycon.com>`,
            to: mail,
            subject: "Diamart",
            text: `Dear ${name}, we have received your appeal and will get back to you with a response soon!\n\n
            Best regards,\n
            Diamart team`,
}
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }

    DiamartToNazim(name, phone, mail, message){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `Diamart <hello@clycon.com>`,
            to: "info@diamart.ch",
            subject: "New Diamart Client",
            text: `New Diamart Landing lead:\n\nName: ${name}\nPhone: ${phone}\nMail: ${mail}\nMessage: ${message}`,
}
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }


    NewReceptionMail(personMail, personName, company, fillial_city, fillial_adress, employee_name, serviceList, date, time, endTime){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `${company} <hello@clycon.com>`,
            to: personMail,
            subject: "Вы записаны на приём!",
            text: "Отлично, вы записаны на приём в 12:22",
            html: `
            <!doctype html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
    xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <title></title>
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
        #outlook a {
            padding: 0;
        }

        body {
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        table,
        td {
            border-collapse: collapse;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }

        img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
        }

        p {
            display: block;
            margin: 0;
        }
    </style>
    <!--[if mso]> <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
    <!--[if lte mso 11]>
<style type="text/css">
.ogf{width:100% !important;}
</style>
<![endif]-->
    <!--[if !mso]><!-->
    <link href="https://fonts.googleapis.com/css?family=Inter:700,400" rel="stylesheet" type="text/css">

    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <!--[if gte mso 9]>
<style>a:link,span.MsoHyperlink{mso-style-priority:99;color:inherit;text-decoration:none;}a:visited,span.MsoHyperlinkFollowed{mso-style-priority:99;color:inherit;text-decoration:none;}li{text-indent:-1em;}table,td,p,div,span,ul,ol,li,a{mso-hyphenate:none;}
</style>
<![endif]-->
</head>

<body lang="en" link="#DD0000" vlink="#DD0000" class="emailify"
    style="mso-line-height-rule:exactly;mso-hyphenate:none;word-spacing:normal;background-color:#fff;">
    <div class="bg" style="background-color:#fff;" lang="en">
        <!--[if mso | IE]>
<table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
<![endif]-->

        <!--[if mso | IE]>
</td></tr></table>
<table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pt-0-outlook pr-0-outlook pb-0-outlook pl-0-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
<![endif]-->
        <div class="r  pt-0 pr-0 pb-0 pl-0"
            style="background:#fff;background-color:#fff;margin:0px auto;">
            <table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation"
                style="background:#fff;background-color:#fff;width:100%;">
                <tbody>
                    <tr>
                        <td align="center" valign="top" class="mob_bg_mr_css_attr" bgcolor="#fff" style="background-position: center top;background-repeat: no-repeat;background-position: center top;">
				
                            <table cellpadding="0" cellspacing="0" border="0" width="600" class="table600_mr_css_attr" style="width: 100%;max-width: 600px;min-width: 320px;">
                                
                                <tbody><tr>
                                    <td align="center" valign="top">
                                        <table class="mob_90_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 288px;">
                                            <tbody><tr>
                                                <td align="left">
                                                    <div class="mob_h32_mr_css_attr" style="height: 22px;line-height: 36px;font-size: 8px;">&nbsp;</div>
                                                    <a href="https://clycon.com" target="_blank" style="display: block;max-width: 160px;" rel=" noopener noreferrer">
                                                        <img src="https://i.postimg.cc/0QxKQYBd/top-Mail-Logo.png" width="85" border="0" alt="" style="display: block;width: 100%;max-width: 160px;">
                                                    </a>
                                                    <div class="mob_h36_mr_css_attr" style="height: 22px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                </td>
                                            </tr>
                                        </tbody></table>
                                    </td>
                                </tr>

                                <tr>
                                    <td align="center" valign="top">
                                        <table class="mob_br24_mr_css_attr mob_90_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 288px;background: #F5F5F5;border-radius: 32px;overflow: hidden;">
                                            <tbody><tr>
                                                <td align="center">
                                                    <table class="mob_75_mr_css_attr" cellpadding="0" cellspacing="0" width="84%" border="0" style="max-width: 480px;min-width: 216px;">
                                                        <tbody><tr>
                                                            <td align="left" valign="middle">
                                                                <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                                <div class="mob_txt32_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #2C2D2E;font-size: 40px;line-height: 46px;">Уведомление о записи</div>
                                                                <div class="mob_h16_mr_css_attr" style="height: 24px;line-height: 24px;font-size: 8px;">&nbsp;</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: Arial, sans-serif;color: #2C2D2E;font-size: 20px;line-height: 28px;">Здравствуйте, ${personName}! Уведомляем вас о записи в "${company}", вот информация о ней:</div>
                                                                <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                            </td>
                                                        </tr>
                                                    </tbody></table>
                                                </td>
                                            </tr>
                                        </tbody></table>
                                        <div class="mob_h36_mr_css_attr" style="height: 12px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                    </td>
                                </tr>
                                
                                
                                <tr>
                                    <td align="center" valign="top">
                                        <table class="mob_br24_mr_css_attr mob_90_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 288px;background: #2073FA;border-radius: 32px;overflow: hidden;">
                                            <tbody><tr>
                                                <td align="center">
                                                    <table class="mob_75_mr_css_attr" cellpadding="0" cellspacing="0" width="84%" border="0" style="max-width: 480px;min-width: 216px;">
                                                        <tbody><tr>
                                                            <td align="left" valign="middle">
                                                                <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                                <div class="mob_txt24_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 36px;line-height: 46px;">О записи</div> 
                                                                <div class="mob_h8_mr_css_attr" style="height: 14px;line-height: 14px;font-size: 8px;">&nbsp;</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start;">Дата: ${date}</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start;">Время: ${time} - ${endTime}</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start; margin-top: 8px;">${serviceList.length === 1 ? `Услуга: ${serviceList[0]}` :  `Услуги: ${serviceList.map((service) => {return(`  ${service}`)})}`}</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start; margin-top: 8px;">Адрес филиала: ${fillial_city}, ${fillial_adress}</div> 
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start; margin-top: 8px;">Вас примет: ${employee_name}</div>
                                        
                                                                <div class="mob_h8_mr_css_attr" style="height: 14px;line-height: 14px;font-size: 8px; ">&nbsp;</div>
                                                                <div class="mob_h8_mr_css_attr" style="height: 14px;line-height: 14px;font-size: 8px;">&nbsp;</div>
                                                                <table cellpadding="0" cellspacing="0" width="55%" border="0" style="max-width: 235px;min-width: 235px;">
                                                                    <tbody><tr>
                                                                        <td class="mob_btn1_mr_css_attr" align="center" valign="middle" height="60" style="height: 60px;background: #1F1F1F;border-radius: 12px;">
                                                                            <a href="https://www.google.ru/maps/search/${fillial_city},+${fillial_adress},+${company}" class="mob_btn2_mr_css_attr" target="_blank" style="display: block;width: 100%;height: 60px;font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 60px;text-decoration: none;" rel=" noopener noreferrer">Адрес на карте</a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody></table>
                                                                <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                            </td>
                                                        </tr>
                                                    </tbody></table>
                                                </td>
                                            </tr>
                                        </tbody></table>
                                        <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                    </td>
                                </tr>
                                
                                <tr>
                                    <td align="center" valign="top">
                                        <table class="mob_75_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 248px;">
                                            <tbody><tr>
                                                <td align="left">
                                                    <div class="mob_txt20_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #2C2D2E;font-size: 28px;line-height: 36px;">С заботой о вас, команда Clycon.com</span></div>
                                                    <div class="mob_h16_mr_css_attr" style="height: 20px;line-height: 20px;font-size: 8px;">&nbsp;</div>                                
                                                    <a href="https://clycon.com" target="_blank" style="display: block;max-width: 128px;" rel=" noopener noreferrer">
                                                        <img src="https://i.postimg.cc/bwzwjSxt/bottom-Mail-Logo.png" width="128" height="36" border="0" alt="" style="display: block;width: 100%;max-width: 128px;">
                                                    </a>
                                                    <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                </td>
                                            </tr>
                                        </tbody></table>
                                    </td>
                                </tr>
                                
                            </tbody></table>
                            
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!--[if mso | IE]>
</td></tr></table>
<![endif]-->
    </div>
</body>

</html>
            `,
        }
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }


    NewReceptionMailForDoctor(doctorMail, doctorName, company, fillial_city, fillial_adress, clientName, serviceList, date, time, endTime){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `${company} <hello@clycon.com>`,
            to: doctorMail,
            subject: "У Вас новая запись!",
            text: "Отлично, у вас новая запись в 12:22",
            html: `
            <!doctype html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
    xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <title></title>
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
        #outlook a {
            padding: 0;
        }

        body {
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        table,
        td {
            border-collapse: collapse;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }

        img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
        }

        p {
            display: block;
            margin: 0;
        }
    </style>
    <!--[if mso]> <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
    <!--[if lte mso 11]>
<style type="text/css">
.ogf{width:100% !important;}
</style>
<![endif]-->
    <!--[if !mso]><!-->
    <link href="https://fonts.googleapis.com/css?family=Inter:700,400" rel="stylesheet" type="text/css">

    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <!--[if gte mso 9]>
<style>a:link,span.MsoHyperlink{mso-style-priority:99;color:inherit;text-decoration:none;}a:visited,span.MsoHyperlinkFollowed{mso-style-priority:99;color:inherit;text-decoration:none;}li{text-indent:-1em;}table,td,p,div,span,ul,ol,li,a{mso-hyphenate:none;}
</style>
<![endif]-->
</head>

<body lang="en" link="#DD0000" vlink="#DD0000" class="emailify"
    style="mso-line-height-rule:exactly;mso-hyphenate:none;word-spacing:normal;background-color:#fff;">
    <div class="bg" style="background-color:#fff;" lang="en">
        <!--[if mso | IE]>
<table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
<![endif]-->

        <!--[if mso | IE]>
</td></tr></table>
<table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pt-0-outlook pr-0-outlook pb-0-outlook pl-0-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
<![endif]-->
        <div class="r  pt-0 pr-0 pb-0 pl-0"
            style="background:#fff;background-color:#fff;margin:0px auto;">
            <table align="left" border="0" cellpadding="0" cellspacing="0" role="presentation"
                style="background:#fff;background-color:#fff;width:100%;">
                <tbody>
                    <tr>
                        <td align="center" valign="top" class="mob_bg_mr_css_attr" bgcolor="#fff" style="background-position: center top;background-repeat: no-repeat;background-position: center top;">
				
                            <table cellpadding="0" cellspacing="0" border="0" width="600" class="table600_mr_css_attr" style="width: 100%;max-width: 600px;min-width: 320px;">
                                
                                <tbody><tr>
                                    <td align="center" valign="top">
                                        <table class="mob_90_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 288px;">
                                            <tbody><tr>
                                                <td align="left">
                                                    <div class="mob_h32_mr_css_attr" style="height: 22px;line-height: 36px;font-size: 8px;">&nbsp;</div>
                                                    <a href="https://clycon.com" target="_blank" style="display: block;max-width: 160px;" rel=" noopener noreferrer">
                                                        <img src="https://i.postimg.cc/0QxKQYBd/top-Mail-Logo.png" width="85" border="0" alt="" style="display: block;width: 100%;max-width: 160px;">
                                                    </a>
                                                    <div class="mob_h36_mr_css_attr" style="height: 22px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                </td>
                                            </tr>
                                        </tbody></table>
                                    </td>
                                </tr>

                                <tr>
                                    <td align="center" valign="top">
                                        <table class="mob_br24_mr_css_attr mob_90_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 288px;background: #F5F5F5;border-radius: 32px;overflow: hidden;">
                                            <tbody><tr>
                                                <td align="center">
                                                    <table class="mob_75_mr_css_attr" cellpadding="0" cellspacing="0" width="84%" border="0" style="max-width: 480px;min-width: 216px;">
                                                        <tbody><tr>
                                                            <td align="left" valign="middle">
                                                                <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                                <div class="mob_txt32_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #2C2D2E;font-size: 40px;line-height: 46px;">Уведомление о записи</div>
                                                                <div class="mob_h16_mr_css_attr" style="height: 24px;line-height: 24px;font-size: 8px;">&nbsp;</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: Arial, sans-serif;color: #2C2D2E;font-size: 20px;line-height: 28px;">Здравствуйте, ${doctorName}! Уведомляем Вас о том, что в "${company}" у Вас новая запись, вот информация о ней:</div>
                                                                <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                            </td>
                                                        </tr>
                                                    </tbody></table>
                                                </td>
                                            </tr>
                                        </tbody></table>
                                        <div class="mob_h36_mr_css_attr" style="height: 12px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                    </td>
                                </tr>
                                
                                
                                <tr>
                                    <td align="center" valign="top">
                                        <table class="mob_br24_mr_css_attr mob_90_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 288px;background: #2073FA;border-radius: 32px;overflow: hidden;">
                                            <tbody><tr>
                                                <td align="center">
                                                    <table class="mob_75_mr_css_attr" cellpadding="0" cellspacing="0" width="84%" border="0" style="max-width: 480px;min-width: 216px;">
                                                        <tbody><tr>
                                                            <td align="left" valign="middle">
                                                                <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                                <div class="mob_txt24_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 36px;line-height: 46px;">О записи</div> 
                                                                <div class="mob_h8_mr_css_attr" style="height: 14px;line-height: 14px;font-size: 8px;">&nbsp;</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start;">Дата: ${date}</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start;">Время: ${time} - ${endTime}</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start; margin-top: 8px;">${serviceList.length === 1 ? `Услуга: ${serviceList[0]}` :  `Услуги: ${serviceList.map((service) => {return(`  ${service}`)})}`}</div>
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start; margin-top: 8px;">Адрес филиала: ${fillial_city}, ${fillial_adress}</div> 
                                                                <div class="mob_txt16_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 28px; text-align: start; margin-top: 8px;">Ваш клиент: ${clientName}</div>
                                        
                                                                <div class="mob_h8_mr_css_attr" style="height: 14px;line-height: 14px;font-size: 8px; ">&nbsp;</div>
                                                                <div class="mob_h8_mr_css_attr" style="height: 14px;line-height: 14px;font-size: 8px;">&nbsp;</div>
                                                                <table cellpadding="0" cellspacing="0" width="55%" border="0" style="max-width: 235px;min-width: 235px;">
                                                                    <tbody><tr>
                                                                        <td class="mob_btn1_mr_css_attr" align="center" valign="middle" height="60" style="height: 60px;background: #1F1F1F;border-radius: 12px;">
                                                                            <a href="https://www.google.ru/maps/search/${fillial_city},+${fillial_adress},+${company}" class="mob_btn2_mr_css_attr" target="_blank" style="display: block;width: 100%;height: 60px;font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #ffffff;font-size: 20px;line-height: 60px;text-decoration: none;" rel=" noopener noreferrer">Адрес на карте</a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody></table>
                                                                <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                            </td>
                                                        </tr>
                                                    </tbody></table>
                                                </td>
                                            </tr>
                                        </tbody></table>
                                        <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                    </td>
                                </tr>
                                
                                <tr>
                                    <td align="center" valign="top">
                                        <table class="mob_75_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 248px;">
                                            <tbody><tr>
                                                <td align="left">
                                                    <div class="mob_txt20_mr_css_attr" style="font-family: 'MailSans', Helvetica, Arial, sans-serif;color: #2C2D2E;font-size: 28px;line-height: 36px;">С заботой о вас, команда Clycon.com</span></div>
                                                    <div class="mob_h16_mr_css_attr" style="height: 20px;line-height: 20px;font-size: 8px;">&nbsp;</div>                                
                                                    <a href="https://clycon.com" target="_blank" style="display: block;max-width: 128px;" rel=" noopener noreferrer">
                                                        <img src="https://i.postimg.cc/bwzwjSxt/bottom-Mail-Logo.png" width="128" height="36" border="0" alt="" style="display: block;width: 100%;max-width: 128px;">
                                                    </a>
                                                    <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                                </td>
                                            </tr>
                                        </tbody></table>
                                    </td>
                                </tr>
                                
                            </tbody></table>
                            
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!--[if mso | IE]>
</td></tr></table>
<![endif]-->
    </div>
</body>

</html>
            `,
        }
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }



    landingMail(reason, name, phone, mail){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `Сообщение с лендинга <hello@clycon.com>`,
            to: "i@ivlad.ru",
            subject: `Лендинг: ${reason}`,
            text: `Цель: ${reason}\n
                    Имя: ${name}\n
                    Телефон: ${phone}
                    Почта: ${mail}`,
        }
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }

    invitationMail(personName, personMail, company, link){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `${company} <hello@clycon.com>`,
            to: personMail,
            subject: "Приглашение в компанию",
            text: `Приветствуем, ${personName}, вас пригласили в компанию ${company}, чтобы принять приглашение перейдите по ссылке и завершите регистрацию: ${link}`,
            html: `<!doctype html>
            <html lang="ru" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
                xmlns:o="urn:schemas-microsoft-com:office:office">
            
            <head>
                <title></title>
                <!--[if !mso]><!-->
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <!--<![endif]-->
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style type="text/css">
                    #outlook a {
                        padding: 0;
                    }
            
                    body {
                        margin: 0;
                        padding: 0;
                        -webkit-text-size-adjust: 100%;
                        -ms-text-size-adjust: 100%;
                    }
            
                    table,
                    td {
                        border-collapse: collapse;
                        mso-table-lspace: 0pt;
                        mso-table-rspace: 0pt;
                    }
            
                    img {
                        border: 0;
                        height: auto;
                        line-height: 100%;
                        outline: none;
                        text-decoration: none;
                        -ms-interpolation-mode: bicubic;
                    }
            
                    p {
                        display: block;
                        margin: 0;
                    }
                </style>
                <!--[if mso]> <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
            <![endif]-->
                <!--[if lte mso 11]>
            <style type="text/css">
            .ogf{width:100% !important;}
            </style>
            <![endif]-->
                <!--[if !mso]><!-->
                <link href="https://fonts.googleapis.com/css?family=Inter:700,400" rel="stylesheet" type="text/css">
                <style type="text/css">
            
                </style>
                <!--<![endif]-->
                <style type="text/css">
                    @media only screen and (min-width:599px) {
                        .xc568 {
                            width: 599px !important;
                            max-width: 599px;
                        }
            
                        .xc600 {
                            width: 600px !important;
                            max-width: 600px;
                        }
                    }
                </style>
                <style media="screen and (min-width:599px)">
                    .moz-text-html .xc568 {
                        width: 568px !important;
                        max-width: 568px;
                    }
            
                    .moz-text-html .xc600 {
                        width: 600px !important;
                        max-width: 600px;
                    }
                </style>
                <style type="text/css">
                    @media only screen and (max-width:598px) {
                        table.fwm {
                            width: 100% !important;
                        }
            
                        td.fwm {
                            width: auto !important;
                        }
                    }
                </style>
                <style type="text/css">
                    u+.emailify .gs {
                        background: #000;
                        mix-blend-mode: screen;
                        display: inline-block;
                        padding: 0;
                        margin: 0;
                    }
            
                    u+.emailify .gd {
                        background: #000;
                        mix-blend-mode: difference;
                        display: inline-block;
                        padding: 0;
                        margin: 0;
                    }
            
                    p {
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    }
            
                    u+.emailify a,
                    #MessageViewBody a,
                    a[x-apple-data-detectors] {
                        color: inherit !important;
                        text-decoration: none !important;
                        font-size: inherit !important;
                        font-family: inherit !important;
                        font-weight: inherit !important;
                        line-height: inherit !important;
                    }
            
                    td.b .klaviyo-image-block {
                        display: inline;
                        vertical-align: middle;
                    }
            
                    @media only screen and (max-width:599px) {
                        .emailify {
                            height: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                        }
            
                        u+.emailify .glist {
                            margin-left: 1em !important;
                        }
            
                        td.ico.v>div.il>a.l.m,
                        td.ico.v .mn-label {
                            padding-right: 0 !important;
                            padding-bottom: 16px !important;
                        }
            
                        td.x {
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
            
                        .fwm img {
                            max-width: 100% !important;
                            height: auto !important;
                        }
            
                        .aw img {
                            width: auto !important;
                            margin-left: auto !important;
                            margin-right: auto !important;
                        }
            
                        .ah img {
                            height: auto !important;
                        }
            
                        td.b.nw>table,
                        td.b.nw a {
                            width: auto !important;
                        }
            
                        td.stk {
                            border: 0 !important;
                        }
            
                        td.u {
                            height: auto !important;
                        }
            
                        br.sb {
                            display: none !important;
                        }
            
                        .thd-1 .i-thumbnail {
                            display: inline-block !important;
                            height: auto !important;
                            overflow: hidden !important;
                        }
            
                        .hd-1 {
                            display: block !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .ht-1 {
                            display: table !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .hr-1 {
                            display: table-row !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .hc-1 {
                            display: table-cell !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        div.r.pr-16>table>tbody>tr>td,
                        div.r.pr-16>div>table>tbody>tr>td {
                            padding-right: 16px !important
                        }
            
                        div.r.pl-16>table>tbody>tr>td,
                        div.r.pl-16>div>table>tbody>tr>td {
                            padding-left: 16px !important
                        }
            
                        div.r.pt-0>table>tbody>tr>td,
                        div.r.pt-0>div>table>tbody>tr>td {
                            padding-top: 0px !important
                        }
            
                        div.r.pr-0>table>tbody>tr>td,
                        div.r.pr-0>div>table>tbody>tr>td {
                            padding-right: 0px !important
                        }
            
                        div.r.pb-0>table>tbody>tr>td,
                        div.r.pb-0>div>table>tbody>tr>td {
                            padding-bottom: 0px !important
                        }
            
                        div.r.pl-0>table>tbody>tr>td,
                        div.r.pl-0>div>table>tbody>tr>td {
                            padding-left: 0px !important
                        }
            
                        td.b.fw-1>table {
                            width: 100% !important
                        }
            
                        td.fw-1>table>tbody>tr>td>a {
                            display: block !important;
                            width: 100% !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
            
                        td.b.fw-1>table {
                            width: 100% !important
                        }
            
                        td.fw-1>table>tbody>tr>td {
                            width: 100% !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
                    }
            
                    @media (prefers-color-scheme:light) and (max-width:599px) {
                        .ds-1.hd-1 {
                            display: none !important;
                            height: 0 !important;
                            overflow: hidden !important;
                        }
                    }
            
                    @media (prefers-color-scheme:dark) and (max-width:599px) {
                        .ds-1.hd-1 {
                            display: block !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
                    }
                </style>
                <meta name="color-scheme" content="light dark">
                <meta name="supported-color-schemes" content="light dark">
                <!--[if gte mso 9]>
            <style>a:link,span.MsoHyperlink{mso-style-priority:99;color:inherit;text-decoration:none;}a:visited,span.MsoHyperlinkFollowed{mso-style-priority:99;color:inherit;text-decoration:none;}li{text-indent:-1em;}table,td,p,div,span,ul,ol,li,a{mso-hyphenate:none;}
            </style>
            <![endif]-->
            </head>
            
            <body lang="en" link="#DD0000" vlink="#DD0000" class="emailify"
                style="mso-line-height-rule:exactly;mso-hyphenate:none;word-spacing:normal;background-color:#EDEFF2;">
                <div class="bg" style="background-color:#EDEFF2;" lang="en">
                    <!--[if mso | IE]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
            
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pt-0-outlook pr-0-outlook pb-0-outlook pl-0-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pt-0 pr-0 pb-0 pl-0"
                        style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:0;text-align:left;">
                                        <!--[if mso | IE]>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:600px;">
            <![endif]-->
                                        <div class="xc600 ogf c"
                                            style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                style="border:none;vertical-align:middle;" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td align="center" class="i  fw-1"
                                                            style="font-size:0;padding:0;word-break:break-word;padding: 12px 0px 0px 0px;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:collapse;border-spacing:0;padding: 12px 0px 0px 0px;" class="fwm">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="width:600px;" class="fwm"> <img alt
                                                                                src="https://i.postimg.cc/BvqGnN0C/clycon-mail-banner.png"
                                                                                style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;"
                                                                                title width="600" height="auto">
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pr-16 pl-16"
                        style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:12px 0px 0px 0px;text-align:left;">
                                        <!--[if mso | IE]> 
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:568px;">
            <![endif]-->
                                        <div class="xc568 ogf c"
                                            style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;border-radius: 12px;">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td
                                                            style="background-color:#fffffe;border:none;vertical-align:middle;padding:46px 32px 46px 32px;border-radius: 12px;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style width="100%">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:32px;mso-ansi-font-size:28px;">
                                                                                    <span
                                                                                        style="font-size:28px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#000000;line-height:114%;mso-line-height-alt:32px;mso-ansi-font-size:28px;">
                                                                                        Приветствуем, ${personName}</span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:16px;font-family:Inter,Arial,sans-serif;font-weight:400;color:#777777;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        Вас пригласили в компанию ${company},<br/>
                                                                                        чтобы приянть приглашение нажмите на кнопку ниже:
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td class="s  m"
                                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;"
                                                                            aria-hidden="true">
                                                                            <div style="height:4px;line-height:4px;">&#8202;</div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" vertical-align="middle" class="b  fw-1"
                                                                            style="font-size:0;padding:0;padding-bottom:0;word-break:break-word;">
                                                                            <table border="0" cellpadding="0" cellspacing="0"
                                                                                role="presentation"
                                                                                style="border-collapse:separate;line-height:100%;">
                                                                                <tbody>
                                                                                    <tr>
                                                                                        <td align="center" bgcolor="#000000"
                                                                                            role="presentation"
                                                                                            style="border:none;border-radius: 12px;cursor:auto;mso-padding-alt:12px 32px 12px 32px;background:#007BFF;padding: 12px 32px;"
                                                                                            valign="middle"> <a
                                                                                                href="https://app.clycon.com/invite/${link}"
                                                                                                style="display:inline-block;width:100%;background:#007BFF;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:12px 0px 12px 0px;mso-padding-alt:0;border-radius:60px 60px 60px 60px;"
                                                                                                target="_blank"> <span
                                                                                                    style="font-size:16px;font-family:Inter,Arial,sans-serif;font-weight:500;color:#ffffff;line-height:121%;mso-line-height-alt:18px;mso-ansi-font-size:16px;">
                                                                                                    Принять приглашение</span></a>
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pr-16 pl-16"
                        style="box-sizing: border-box;width: 100%;background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:12px 0px 0px 0px;text-align:left;width: 10%">
                                        <!--[if mso | IE]>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:568px;">
            <![endif]-->
                                        <div class="xc568 ogf c"
                                            style="background:#EDEFF2;background-color:#fff;margin:0px auto;max-width:600px;border-radius: 12px">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                style="border:none;vertical-align:middle;" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td align="center" vertical-align="middle" class="b  fw-1 m"
                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:separate;width:100%;line-height:100%;">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center" bgcolor="transparent" role="presentation"
                                                                            style="border:none;cursor:auto;mso-padding-alt:4px 0px 4px 0px;background:transparent;width: 100%"
                                                                            valign="middle"> <a href="tel:+79127864632"
                                                                                style="text-align:start;display:inline-block;width:100%;background:transparent;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:12px 22px 0px 22px;mso-padding-alt:0;"
                                                                                target="_blank"> <span
                                                                                    style="font-size:13px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#4d4d4d;line-height:123%;text-decoration:underline;mso-line-height-alt:16px;mso-ansi-font-size:14px;">+7 (912) 786-46-32 </span></a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td align="center" vertical-align="middle" class="b  fw-1 m"
                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:separate;width:100%;line-height:100%;">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center" bgcolor="transparent" role="presentation"
                                                                            style="border:none;cursor:auto;mso-padding-alt:4px 0px 4px 0px;background:transparent;"
                                                                            valign="middle"> <a href="mailto:hello@clycon.com"
                                                                                style="text-align:start;display:inline-block;width:100%;background:transparent;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:4px 22px 12px 22px;mso-padding-alt:0;"
                                                                                target="_blank"> <span
                                                                                    style="font-size:13px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#4d4d4d;line-height:123%;text-decoration:underline;mso-line-height-alt:16px;mso-ansi-font-size:14px;">hello@clycon.com</span></a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                </div>
            </body>
            
            </html>`
        }
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }

    registrationMail(personMail, name, login, password){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `Clycon <hello@clycon.com>`,
            to: personMail,
            subject: "Благодарим за регистрацию!",
            text: `Приветствуем, ${name}, благодарим вас за регистрацию в Clycon! Вот данные для входа в систему: Логин: ${login}, Пароль: ${password}`,
            html: `
            <!doctype html>
            <html lang="ru" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
                xmlns:o="urn:schemas-microsoft-com:office:office">
            
            <head>
                <title></title>
                <!--[if !mso]><!-->
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <!--<![endif]-->
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style type="text/css">
                    #outlook a {
                        padding: 0;
                    }
            
                    body {
                        margin: 0;
                        padding: 0;
                        -webkit-text-size-adjust: 100%;
                        -ms-text-size-adjust: 100%;
                    }
            
                    table,
                    td {
                        border-collapse: collapse;
                        mso-table-lspace: 0pt;
                        mso-table-rspace: 0pt;
                    }
            
                    img {
                        border: 0;
                        height: auto;
                        line-height: 100%;
                        outline: none;
                        text-decoration: none;
                        -ms-interpolation-mode: bicubic;
                    }
            
                    p {
                        display: block;
                        margin: 0;
                    }
                </style>
                <!--[if mso]> <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
            <![endif]-->
                <!--[if lte mso 11]>
            <style type="text/css">
            .ogf{width:100% !important;}
            </style>
            <![endif]-->
                <!--[if !mso]><!-->
                <link href="https://fonts.googleapis.com/css?family=Inter:700,400" rel="stylesheet" type="text/css">
                <style type="text/css">
            
                </style>
                <!--<![endif]-->
                <style type="text/css">
                    @media only screen and (min-width:599px) {
                        .xc568 {
                            width: 599px !important;
                            max-width: 599px;
                        }
            
                        .xc600 {
                            width: 600px !important;
                            max-width: 600px;
                        }
                    }
                </style>
                <style media="screen and (min-width:599px)">
                    .moz-text-html .xc568 {
                        width: 568px !important;
                        max-width: 568px;
                    }
            
                    .moz-text-html .xc600 {
                        width: 600px !important;
                        max-width: 600px;
                    }
                </style>
                <style type="text/css">
                    @media only screen and (max-width:598px) {
                        table.fwm {
                            width: 100% !important;
                        }
            
                        td.fwm {
                            width: auto !important;
                        }
                    }
                </style>
                <style type="text/css">
                    u+.emailify .gs {
                        background: #000;
                        mix-blend-mode: screen;
                        display: inline-block;
                        padding: 0;
                        margin: 0;
                    }
            
                    u+.emailify .gd {
                        background: #000;
                        mix-blend-mode: difference;
                        display: inline-block;
                        padding: 0;
                        margin: 0;
                    }
            
                    p {
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    }
            
                    u+.emailify a,
                    #MessageViewBody a,
                    a[x-apple-data-detectors] {
                        color: inherit !important;
                        text-decoration: none !important;
                        font-size: inherit !important;
                        font-family: inherit !important;
                        font-weight: inherit !important;
                        line-height: inherit !important;
                    }
            
                    td.b .klaviyo-image-block {
                        display: inline;
                        vertical-align: middle;
                    }
            
                    @media only screen and (max-width:599px) {
                        .emailify {
                            height: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                        }
            
                        u+.emailify .glist {
                            margin-left: 1em !important;
                        }
            
                        td.ico.v>div.il>a.l.m,
                        td.ico.v .mn-label {
                            padding-right: 0 !important;
                            padding-bottom: 16px !important;
                        }
            
                        td.x {
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
            
                        .fwm img {
                            max-width: 100% !important;
                            height: auto !important;
                        }
            
                        .aw img {
                            width: auto !important;
                            margin-left: auto !important;
                            margin-right: auto !important;
                        }
            
                        .ah img {
                            height: auto !important;
                        }
            
                        td.b.nw>table,
                        td.b.nw a {
                            width: auto !important;
                        }
            
                        td.stk {
                            border: 0 !important;
                        }
            
                        td.u {
                            height: auto !important;
                        }
            
                        br.sb {
                            display: none !important;
                        }
            
                        .thd-1 .i-thumbnail {
                            display: inline-block !important;
                            height: auto !important;
                            overflow: hidden !important;
                        }
            
                        .hd-1 {
                            display: block !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .ht-1 {
                            display: table !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .hr-1 {
                            display: table-row !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .hc-1 {
                            display: table-cell !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        div.r.pr-16>table>tbody>tr>td,
                        div.r.pr-16>div>table>tbody>tr>td {
                            padding-right: 16px !important
                        }
            
                        div.r.pl-16>table>tbody>tr>td,
                        div.r.pl-16>div>table>tbody>tr>td {
                            padding-left: 16px !important
                        }
            
                        div.r.pt-0>table>tbody>tr>td,
                        div.r.pt-0>div>table>tbody>tr>td {
                            padding-top: 0px !important
                        }
            
                        div.r.pr-0>table>tbody>tr>td,
                        div.r.pr-0>div>table>tbody>tr>td {
                            padding-right: 0px !important
                        }
            
                        div.r.pb-0>table>tbody>tr>td,
                        div.r.pb-0>div>table>tbody>tr>td {
                            padding-bottom: 0px !important
                        }
            
                        div.r.pl-0>table>tbody>tr>td,
                        div.r.pl-0>div>table>tbody>tr>td {
                            padding-left: 0px !important
                        }
            
                        td.b.fw-1>table {
                            width: 100% !important
                        }
            
                        td.fw-1>table>tbody>tr>td>a {
                            display: block !important;
                            width: 100% !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
            
                        td.b.fw-1>table {
                            width: 100% !important
                        }
            
                        td.fw-1>table>tbody>tr>td {
                            width: 100% !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
                    }
            
                    @media (prefers-color-scheme:light) and (max-width:599px) {
                        .ds-1.hd-1 {
                            display: none !important;
                            height: 0 !important;
                            overflow: hidden !important;
                        }
                    }
            
                    @media (prefers-color-scheme:dark) and (max-width:599px) {
                        .ds-1.hd-1 {
                            display: block !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
                    }
                </style>
                <meta name="color-scheme" content="light dark">
                <meta name="supported-color-schemes" content="light dark">
                <!--[if gte mso 9]>
            <style>a:link,span.MsoHyperlink{mso-style-priority:99;color:inherit;text-decoration:none;}a:visited,span.MsoHyperlinkFollowed{mso-style-priority:99;color:inherit;text-decoration:none;}li{text-indent:-1em;}table,td,p,div,span,ul,ol,li,a{mso-hyphenate:none;}
            </style>
            <![endif]-->
            </head>
            
            <body lang="en" link="#DD0000" vlink="#DD0000" class="emailify"
                style="mso-line-height-rule:exactly;mso-hyphenate:none;word-spacing:normal;background-color:#EDEFF2;">
                <div class="bg" style="background-color:#EDEFF2;" lang="en">
                    <!--[if mso | IE]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
            
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pt-0-outlook pr-0-outlook pb-0-outlook pl-0-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pt-0 pr-0 pb-0 pl-0"
                        style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:0;text-align:left;">
                                        <!--[if mso | IE]>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:600px;">
            <![endif]-->
                                        <div class="xc600 ogf c"
                                            style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                style="border:none;vertical-align:middle;" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td align="center" class="i  fw-1"
                                                            style="font-size:0;padding:0;word-break:break-word;padding: 12px 0px 0px 0px;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:collapse;border-spacing:0;padding: 12px 0px 0px 0px;" class="fwm">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="width:600px;" class="fwm"> <img alt
                                                                                src="https://i.postimg.cc/BvqGnN0C/clycon-mail-banner.png"
                                                                                style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;"
                                                                                title width="600" height="auto">
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pr-16 pl-16"
                        style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:12px 0px 0px 0px;text-align:left;">
                                        <!--[if mso | IE]> 
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:568px;">
            <![endif]-->
                                        <div class="xc568 ogf c"
                                            style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;border-radius: 12px;">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td
                                                            style="background-color:#fffffe;border:none;vertical-align:middle;padding:46px 32px 46px 32px;border-radius: 12px;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style width="100%">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:32px;mso-ansi-font-size:28px;">
                                                                                    <span
                                                                                        style="font-size:28px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#000000;line-height:114%;mso-line-height-alt:32px;mso-ansi-font-size:28px;">
                                                                                        Приветствуем, ${name}</span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:18px;font-family:Inter,Arial,sans-serif;font-weight:400;color:#202020;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        Благодарим Вас за регистрацию в Clycon, мы расчитываем на успешное и долгосрочное сотрудничество!
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>

                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;margin-top:22px;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:18px;font-family:Inter,Arial,sans-serif;font-weight:400;color:#202020;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        Данные от вашего аккаунта:
                                                                                    </span>
                                                                                </p>
                                                                                <p
                                                                                    style="Margin:0;margin-top:8px;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:18px;font-family:Inter,Arial,sans-serif;font-weight:400;color:#202020;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        <strong>Логин: </strong>${login}
                                                                                    </span>
                                                                                </p>
                                                                                <p
                                                                                    style="Margin:0;margin-top:8px;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:18px;font-family:Inter,Arial,sans-serif;font-weight:400;color:#202020;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        <strong>Пароль: </strong>${password}
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>

                                                                    <tr>
                                                                        <td class="s  m"
                                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;"
                                                                            aria-hidden="true">
                                                                            <div style="height:4px;line-height:4px;">&#8202;</div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" vertical-align="middle" class="b  fw-1"
                                                                            style="display:flex;margin-top:22px;font-size:0;padding:0;padding-bottom:0;word-break:break-word;">
                                                                            <table border="0" cellpadding="0" cellspacing="0"
                                                                                role="presentation"
                                                                                style="border-collapse:separate;line-height:100%;">
                                                                                <tbody>
                                                                                    <tr>
                                                                                        <td align="center" bgcolor="#000000"
                                                                                            role="presentation"
                                                                                            style="border:none;border-radius: 12px;cursor:auto;mso-padding-alt:12px 64px 12px 64px;background:#007BFF;padding: 12px 64px;"
                                                                                            valign="middle"> <a
                                                                                                href="https://app.clycon.com/"
                                                                                                style="display:inline-block;width:100%;background:#007BFF;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:12px 0px 12px 0px;mso-padding-alt:0;border-radius:60px 60px 60px 60px;"
                                                                                                target="_blank"> <span
                                                                                                    style="font-size:16px;font-family:Inter,Arial,sans-serif;font-weight:500;color:#ffffff;line-height:121%;mso-line-height-alt:18px;mso-ansi-font-size:16px;">
                                                                                                    Войти в систему</span></a>
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;margin-top:22px;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:16px;font-family:Inter,Arial,sans-serif;font-weight:400;color:#888888;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        В целях безопасности, мы настоятельно рекомендуем перенести эту информацию на бумажный или иной носитель и удалить данное письмо.
                                                                                    </span>
                                                                                </p>
                                                                            </div>                                                                      
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pr-16 pl-16"
                        style="box-sizing: border-box;width: 100%;background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:12px 0px 0px 0px;text-align:left;width: 10%">
                                        <!--[if mso | IE]>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:568px;">
            <![endif]-->
                                        <div class="xc568 ogf c"
                                            style="background:#EDEFF2;background-color:#fff;margin:0px auto;max-width:600px;border-radius: 12px">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                style="border:none;vertical-align:middle;" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td align="center" vertical-align="middle" class="b  fw-1 m"
                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:separate;width:100%;line-height:100%;">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center" bgcolor="transparent" role="presentation"
                                                                            style="border:none;cursor:auto;mso-padding-alt:4px 0px 4px 0px;background:transparent;width: 100%"
                                                                            valign="middle"> <a href="tel:+79127864632"
                                                                                style="text-align:start;display:inline-block;width:100%;background:transparent;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:12px 22px 0px 22px;mso-padding-alt:0;"
                                                                                target="_blank"> <span
                                                                                    style="font-size:13px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#4d4d4d;line-height:123%;text-decoration:underline;mso-line-height-alt:16px;mso-ansi-font-size:14px;">+7 (912) 786-46-32 </span></a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td align="center" vertical-align="middle" class="b  fw-1 m"
                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:separate;width:100%;line-height:100%;">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center" bgcolor="transparent" role="presentation"
                                                                            style="border:none;cursor:auto;mso-padding-alt:4px 0px 4px 0px;background:transparent;"
                                                                            valign="middle"> <a href="mailto:hello@clycon.com"
                                                                                style="text-align:start;display:inline-block;width:100%;background:transparent;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:4px 22px 12px 22px;mso-padding-alt:0;"
                                                                                target="_blank"> <span
                                                                                    style="font-size:13px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#4d4d4d;line-height:123%;text-decoration:underline;mso-line-height-alt:16px;mso-ansi-font-size:14px;">hello@clycon.com</span></a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                </div>
            </body>
            
            </html>
            `
        }
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }

    IDPlandingMail(contactName, contactContact){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `IDP <hello@clycon.com>`,
            to: contactContact,
            subject: "Спасибо за обращение!",
            text: `Спасибо, ${contactName}, мы получили ваше сообщение и ответим в ближайшее время.

С уваежением, команда IDP

Единый номер: +375297944933
info@idp.by`,
            html: `<!doctype html>
            <html lang="ru" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
                xmlns:o="urn:schemas-microsoft-com:office:office">
            
            <head>
                <title></title>
                <!--[if !mso]><!-->
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <!--<![endif]-->
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style type="text/css">
                    #outlook a {
                        padding: 0;
                    }
            
                    body {
                        margin: 0;
                        padding: 0;
                        -webkit-text-size-adjust: 100%;
                        -ms-text-size-adjust: 100%;
                    }
            
                    table,
                    td {
                        border-collapse: collapse;
                        mso-table-lspace: 0pt;
                        mso-table-rspace: 0pt;
                    }
            
                    img {
                        border: 0;
                        height: auto;
                        line-height: 100%;
                        outline: none;
                        text-decoration: none;
                        -ms-interpolation-mode: bicubic;
                    }
            
                    p {
                        display: block;
                        margin: 0;
                    }
                </style>
                <!--[if mso]> <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
                        <![endif]-->
                <!--[if lte mso 11]>
                        <style type="text/css">
                        .ogf{width:100% !important;}
                        </style>
                        <![endif]-->
                <!--[if !mso]><!-->
                <link href="https://fonts.googleapis.com/css?family=Inter:700,400" rel="stylesheet" type="text/css">
                <style type="text/css">
            
                </style>
                <!--<![endif]-->
                <style type="text/css">
                    @media only screen and (min-width:599px) {
                        .xc568 {
                            width: 599px !important;
                            max-width: 599px;
                        }
            
                        .xc600 {
                            width: 600px !important;
                            max-width: 600px;
                        }
                    }
                </style>
                <style media="screen and (min-width:599px)">
                    .moz-text-html .xc568 {
                        width: 568px !important;
                        max-width: 568px;
                    }
            
                    .moz-text-html .xc600 {
                        width: 600px !important;
                        max-width: 600px;
                    }
                </style>
                <style type="text/css">
                    @media only screen and (max-width:598px) {
                        table.fwm {
                            width: 100% !important;
                        }
            
                        td.fwm {
                            width: auto !important;
                        }
                    }
                </style>
                <style type="text/css">
                    u+.emailify .gs {
                        background: #000;
                        mix-blend-mode: screen;
                        display: inline-block;
                        padding: 0;
                        margin: 0;
                    }
            
                    u+.emailify .gd {
                        background: #000;
                        mix-blend-mode: difference;
                        display: inline-block;
                        padding: 0;
                        margin: 0;
                    }
            
                    p {
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    }
            
                    u+.emailify a,
                    #MessageViewBody a,
                    a[x-apple-data-detectors] {
                        color: inherit !important;
                        text-decoration: none !important;
                        font-size: inherit !important;
                        font-family: inherit !important;
                        font-weight: inherit !important;
                        line-height: inherit !important;
                    }
            
                    td.b .klaviyo-image-block {
                        display: inline;
                        vertical-align: middle;
                    }
            
                    @media only screen and (max-width:599px) {
                        .emailify {
                            height: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                        }
            
                        u+.emailify .glist {
                            margin-left: 1em !important;
                        }
            
                        td.ico.v>div.il>a.l.m,
                        td.ico.v .mn-label {
                            padding-right: 0 !important;
                            padding-bottom: 16px !important;
                        }
            
                        td.x {
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
            
                        .fwm img {
                            max-width: 100% !important;
                            height: auto !important;
                        }
            
                        .aw img {
                            width: auto !important;
                            margin-left: auto !important;
                            margin-right: auto !important;
                        }
            
                        .ah img {
                            height: auto !important;
                        }
            
                        td.b.nw>table,
                        td.b.nw a {
                            width: auto !important;
                        }
            
                        td.stk {
                            border: 0 !important;
                        }
            
                        td.u {
                            height: auto !important;
                        }
            
                        br.sb {
                            display: none !important;
                        }
            
                        .thd-1 .i-thumbnail {
                            display: inline-block !important;
                            height: auto !important;
                            overflow: hidden !important;
                        }
            
                        .hd-1 {
                            display: block !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .ht-1 {
                            display: table !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .hr-1 {
                            display: table-row !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .hc-1 {
                            display: table-cell !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        div.r.pr-16>table>tbody>tr>td,
                        div.r.pr-16>div>table>tbody>tr>td {
                            padding-right: 16px !important
                        }
            
                        div.r.pl-16>table>tbody>tr>td,
                        div.r.pl-16>div>table>tbody>tr>td {
                            padding-left: 16px !important
                        }
            
                        div.r.pt-0>table>tbody>tr>td,
                        div.r.pt-0>div>table>tbody>tr>td {
                            padding-top: 0px !important
                        }
            
                        div.r.pr-0>table>tbody>tr>td,
                        div.r.pr-0>div>table>tbody>tr>td {
                            padding-right: 0px !important
                        }
            
                        div.r.pb-0>table>tbody>tr>td,
                        div.r.pb-0>div>table>tbody>tr>td {
                            padding-bottom: 0px !important
                        }
            
                        div.r.pl-0>table>tbody>tr>td,
                        div.r.pl-0>div>table>tbody>tr>td {
                            padding-left: 0px !important
                        }
            
                        td.b.fw-1>table {
                            width: 100% !important
                        }
            
                        td.fw-1>table>tbody>tr>td>a {
                            display: block !important;
                            width: 100% !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
            
                        td.b.fw-1>table {
                            width: 100% !important
                        }
            
                        td.fw-1>table>tbody>tr>td {
                            width: 100% !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
                    }
            
                    @media (prefers-color-scheme:light) and (max-width:599px) {
                        .ds-1.hd-1 {
                            display: none !important;
                            height: 0 !important;
                            overflow: hidden !important;
                        }
                    }
            
                    @media (prefers-color-scheme:dark) and (max-width:599px) {
                        .ds-1.hd-1 {
                            display: block !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
                    }
                </style>
                <meta name="color-scheme" content="light dark">
                <meta name="supported-color-schemes" content="light dark">
                <!--[if gte mso 9]>
                        <style>a:link,span.MsoHyperlink{mso-style-priority:99;color:inherit;text-decoration:none;}a:visited,span.MsoHyperlinkFollowed{mso-style-priority:99;color:inherit;text-decoration:none;}li{text-indent:-1em;}table,td,p,div,span,ul,ol,li,a{mso-hyphenate:none;}
                        </style>
                        <![endif]-->
            </head>
            
            <body lang="en" link="#DD0000" vlink="#DD0000" class="emailify"
                style="mso-line-height-rule:exactly;mso-hyphenate:none;word-spacing:normal;background-color:#EDEFF2;">
                <div class="bg" style="background-color:#EDEFF2;" lang="en">
                    <!--[if mso | IE]>
                        <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
                        <![endif]-->
            
                    <!--[if mso | IE]>
                        </td></tr></table>
                        <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pt-0-outlook pr-0-outlook pb-0-outlook pl-0-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
                        <![endif]-->
                    <div class="r  pt-0 pr-0 pb-0 pl-0"
                        style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:0;text-align:left;">
                                        <!--[if mso | IE]>
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:600px;">
                        <![endif]-->
                                        <div class="xc600 ogf c"
                                            style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                style="border:none;vertical-align:middle;" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td align="center" class="i  fw-1"
                                                            style="font-size:0;padding:0;word-break:break-word;padding: 12px 0px 0px 0px;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:collapse;border-spacing:0;padding: 12px 0px 0px 0px;"
                                                                class="fwm">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="width:600px;" class="fwm"> <img alt
                                                                                src="https://i.postimg.cc/Wz9yX0Gb/idpMail.png"
                                                                                style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;"
                                                                                title width="600" height="auto">
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
                        </td></tr></table>
                        <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
                        </td></tr></table>
                        <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
                        <![endif]-->
                    <div class="r  pr-16 pl-16"
                        style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:12px 0px 0px 0px;text-align:left;">
                                        <!--[if mso | IE]> 
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:568px;">
                        <![endif]-->
                                        <div class="xc568 ogf c"
                                            style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;border-radius: 12px;">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td
                                                            style="background-color:#fffffe;border:none;vertical-align:middle;padding:42px 32px 32px 32px;border-radius: 12px;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style width="100%">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:32px;mso-ansi-font-size:28px;">
                                                                                    <span
                                                                                        style="font-size:28px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#000000;line-height:114%;mso-line-height-alt:32px;mso-ansi-font-size:28px;">
                                                                                        Здравствуйте, ${contactName}</span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-top:12px;padding-bottom:22px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:18px;font-family:Inter,Arial,sans-serif;font-weight:400;color:#202020;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        Мы получили ваше сообщение, менеджер свяжется с вами как можно скорее.
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:0px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p style="Margin:0;margin-top:8px;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                <span style="font-size:18px;font-family:Inter,Arial,sans-serif;font-weight:400;color:#202020;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    С уважением, команда IDP
                                                                                </span>
                                                                            </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
            
                                                                   
            
                                                                    <tr>
                                                                        <td class="s  m"
                                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;"
                                                                            aria-hidden="true">
                                                                            <div style="height:4px;line-height:4px;">&#8202;</div>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
                        </td></tr></table>
                        <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
                        </td></tr></table>
                        <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
                        <![endif]-->
                    <div class="r  pr-16 pl-16"
                        style="box-sizing: border-box;width: 100%;background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td
                                        style="border:none;direction:ltr;font-size:0;padding:12px 0px 0px 0px;text-align:left;width: 10%">
                                        <!--[if mso | IE]>
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:568px;">
                        <![endif]-->
                                        <div class="xc568 ogf c"
                                            style="background:#EDEFF2;background-color:#fff;margin:0px auto;max-width:600px;border-radius: 12px">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                style="border:none;vertical-align:middle;" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td align="center" vertical-align="middle" class="b  fw-1 m"
                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:separate;width:100%;line-height:100%;">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center" bgcolor="transparent" role="presentation"
                                                                            style="border:none;cursor:auto;mso-padding-alt:4px 0px 4px 0px;background:transparent;width: 100%"
                                                                            valign="middle"> <a href=""
                                                                                style="text-align:start;display:inline-block;width:100%;background:transparent;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:12px 22px 0px 22px;mso-padding-alt:0;"
                                                                                target="_blank"> <span
                                                                                    style="font-size:13px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#4d4d4d;line-height:123%;text-decoration:underline;mso-line-height-alt:16px;mso-ansi-font-size:14px;">
                                                                                    +375 29 794-49-33</span></a>
                                                                                    
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td align="center" vertical-align="middle" class="b  fw-1 m"
                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:separate;width:100%;line-height:100%;">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center" bgcolor="transparent" role="presentation"
                                                                            style="border:none;cursor:auto;mso-padding-alt:4px 0px 4px 0px;background:transparent;"
                                                                            valign="middle"> <a href="mailto:info@idp.by"
                                                                                style="text-align:start;display:inline-block;width:100%;background:transparent;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:4px 22px 12px 22px;mso-padding-alt:0;"
                                                                                target="_blank"> <span
                                                                                    style="font-size:13px;font-family:Inter,Arial,sans-serif;font-weight:700;color:#4d4d4d;line-height:123%;text-decoration:underline;mso-line-height-alt:16px;mso-ansi-font-size:14px;">info@idp.by</span></a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
                        </td></tr></table>
                        <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
                        </td></tr></table>
                        <![endif]-->
                </div>
            </body>
            
            </html>`
        }
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }

    IDPlandingMailtoYaroslav(contactName, contactCompany, contactContact, contactMessage){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `IDP <hello@clycon.com>`,
            to: "info@idp.by",
            subject: "Новая заявка клиента",
            text: `Поступила новая заявка:\n\nИмя: ${contactName}\nКомпания: ${contactCompany}\nКонтакт для связи: ${contactContact}\nСообщение: ${contactMessage}`,
}
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }

    resetPasswordCodeMail(email, code){
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: "hello@clycon.com",
                pass: "ZycfJTcsXXJLswJfzEnL"
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        const options = {
            from: `Clycon <hello@clycon.com>`,
            to: email,
            subject: "Восстановдение пароля Clycon",
            text: `Мы получили запрос на восстановление пароля для аккаунта ${email}. Для восстановления пароля используете код ${code}. Если запрос отправили не вы, свяжитесь с нашей службой технической поддержки по почте hello@clycon.com.`,
            html: `<!doctype html>
            <html lang="ru" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
                xmlns:o="urn:schemas-microsoft-com:office:office">
            
            <head>
                <title></title>
                <!--[if !mso]><!-->
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <!--<![endif]-->
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style type="text/css">
                    #outlook a {
                        padding: 0;
                    }
            
                    body {
                        margin: 0;
                        padding: 0;
                        -webkit-text-size-adjust: 100%;
                        -ms-text-size-adjust: 100%;
                    }
            
                    table,
                    td {
                        border-collapse: collapse;
                        mso-table-lspace: 0pt;
                        mso-table-rspace: 0pt;
                    }
            
                    img {
                        border: 0;
                        height: auto;
                        line-height: 100%;
                        outline: none;
                        text-decoration: none;
                        -ms-interpolation-mode: bicubic;
                    }
            
                    p {
                        display: block;
                        margin: 0;
                    }
                </style>
                <!--[if mso]> <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
            <![endif]-->
                <!--[if lte mso 11]>
            <style type="text/css">
            .ogf{width:100% !important;}
            </style>
            <![endif]-->
                <!--[if !mso]><!-->
                <link href="https://fonts.googleapis.com/css?family=Inter:700,400" rel="stylesheet" type="text/css">
                <style type="text/css">
            
                </style>
                <!--<![endif]-->
                <style type="text/css">
                    @media only screen and (min-width:599px) {
                        .xc568 {
                            width: 599px !important;
                            max-width: 599px;
                        }
            
                        .xc600 {
                            width: 600px !important;
                            max-width: 600px;
                        }
                    }
                </style>
                <style media="screen and (min-width:599px)">
                    .moz-text-html .xc568 {
                        width: 568px !important;
                        max-width: 568px;
                    }
            
                    .moz-text-html .xc600 {
                        width: 600px !important;
                        max-width: 600px;
                    }
                </style>
                <style type="text/css">
                    @media only screen and (max-width:598px) {
                        table.fwm {
                            width: 100% !important;
                        }
            
                        td.fwm {
                            width: auto !important;
                        }
                    }
                </style>
                <style type="text/css">
                    u+.emailify .gs {
                        background: #000;
                        mix-blend-mode: screen;
                        display: inline-block;
                        padding: 0;
                        margin: 0;
                    }
            
                    u+.emailify .gd {
                        background: #000;
                        mix-blend-mode: difference;
                        display: inline-block;
                        padding: 0;
                        margin: 0;
                    }
            
                    p {
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    }
            
                    u+.emailify a,
                    #MessageViewBody a,
                    a[x-apple-data-detectors] {
                        color: inherit !important;
                        text-decoration: none !important;
                        font-size: inherit !important;
                        font-family: inherit !important;
                        font-weight: inherit !important;
                        line-height: inherit !important;
                    }
            
                    td.b .klaviyo-image-block {
                        display: inline;
                        vertical-align: middle;
                    }
            
                    @media only screen and (max-width:599px) {
                        .emailify {
                            height: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                        }
            
                        u+.emailify .glist {
                            margin-left: 1em !important;
                        }
            
                        td.ico.v>div.il>a.l.m,
                        td.ico.v .mn-label {
                            padding-right: 0 !important;
                            padding-bottom: 16px !important;
                        }
            
                        td.x {
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
            
                        .fwm img {
                            max-width: 100% !important;
                            height: auto !important;
                        }
            
                        .aw img {
                            width: auto !important;
                            margin-left: auto !important;
                            margin-right: auto !important;
                        }
            
                        .ah img {
                            height: auto !important;
                        }
            
                        td.b.nw>table,
                        td.b.nw a {
                            width: auto !important;
                        }
            
                        td.stk {
                            border: 0 !important;
                        }
            
                        td.u {
                            height: auto !important;
                        }
            
                        br.sb {
                            display: none !important;
                        }
            
                        .thd-1 .i-thumbnail {
                            display: inline-block !important;
                            height: auto !important;
                            overflow: hidden !important;
                        }
            
                        .hd-1 {
                            display: block !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .ht-1 {
                            display: table !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .hr-1 {
                            display: table-row !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        .hc-1 {
                            display: table-cell !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
            
                        div.r.pr-16>table>tbody>tr>td,
                        div.r.pr-16>div>table>tbody>tr>td {
                            padding-right: 16px !important
                        }
            
                        div.r.pl-16>table>tbody>tr>td,
                        div.r.pl-16>div>table>tbody>tr>td {
                            padding-left: 16px !important
                        }
            
                        div.r.pt-0>table>tbody>tr>td,
                        div.r.pt-0>div>table>tbody>tr>td {
                            padding-top: 0px !important
                        }
            
                        div.r.pr-0>table>tbody>tr>td,
                        div.r.pr-0>div>table>tbody>tr>td {
                            padding-right: 0px !important
                        }
            
                        div.r.pb-0>table>tbody>tr>td,
                        div.r.pb-0>div>table>tbody>tr>td {
                            padding-bottom: 0px !important
                        }
            
                        div.r.pl-0>table>tbody>tr>td,
                        div.r.pl-0>div>table>tbody>tr>td {
                            padding-left: 0px !important
                        }
            
                        td.b.fw-1>table {
                            width: 100% !important
                        }
            
                        td.fw-1>table>tbody>tr>td>a {
                            display: block !important;
                            width: 100% !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
            
                        td.b.fw-1>table {
                            width: 100% !important
                        }
            
                        td.fw-1>table>tbody>tr>td {
                            width: 100% !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                        }
                    }
            
                    @media (prefers-color-scheme:light) and (max-width:599px) {
                        .ds-1.hd-1 {
                            display: none !important;
                            height: 0 !important;
                            overflow: hidden !important;
                        }
                    }
            
                    @media (prefers-color-scheme:dark) and (max-width:599px) {
                        .ds-1.hd-1 {
                            display: block !important;
                            height: auto !important;
                            overflow: visible !important;
                        }
                    }
                </style>
                <meta name="color-scheme" content="light dark">
                <meta name="supported-color-schemes" content="light dark">
                <!--[if gte mso 9]>
            <style>a:link,span.MsoHyperlink{mso-style-priority:99;color:inherit;text-decoration:none;}a:visited,span.MsoHyperlinkFollowed{mso-style-priority:99;color:inherit;text-decoration:none;}li{text-indent:-1em;}table,td,p,div,span,ul,ol,li,a{mso-hyphenate:none;}
            </style>
            <![endif]-->
            </head>
            
            <body lang="en" link="#DD0000" vlink="#DD0000" class="emailify"
                style="mso-line-height-rule:exactly;mso-hyphenate:none;word-spacing:normal;background-color:#EDEFF2;">
                <div class="bg" style="background-color:#EDEFF2;" lang="en">
                    <!--[if mso | IE]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
            
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pt-0-outlook pr-0-outlook pb-0-outlook pl-0-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pt-0 pr-0 pb-0 pl-0"
                        style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:0;text-align:left;">
                                        <!--[if mso | IE]>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:600px;">
            <![endif]-->
                                        <div class="xc600 ogf c"
                                            style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                style="border:none;vertical-align:middle;" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td align="center" class="i  fw-1"
                                                            style="font-size:0;padding:0;word-break:break-word;padding: 12px 0px 0px 0px;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:collapse;border-spacing:0;padding: 12px 0px 0px 0px;" class="fwm">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="width:600px;" class="fwm"> <img alt
                                                                                src="https://i.postimg.cc/BvqGnN0C/clycon-mail-banner.png"
                                                                                style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;"
                                                                                title width="600" height="auto">
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pr-16 pl-16"
                        style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:12px 0px 0px 0px;text-align:left;">
                                        <!--[if mso | IE]> 
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:568px;">
            <![endif]-->
                                        <div class="xc568 ogf c"
                                            style="background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;border-radius: 12px;">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td
                                                            style="background-color:#fffffe;border:none;vertical-align:middle;padding:46px 32px 46px 32px;border-radius: 12px;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style width="100%">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:32px;mso-ansi-font-size:28px;">
                                                                                    <span
                                                                                        style="font-size:28px;font-family: 'MailSans', Inter,Arial,sans-serif;font-weight:700;color:#000000;line-height:114%;mso-line-height-alt:32px;mso-ansi-font-size:28px;">
                                                                                        Восстановление пароля</span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:16px;font-family: 'MailSans', Inter,Arial,sans-serif;font-weight:400;color:#777777;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        Мы получили запрос на восстановление пароля для аккаунта ${email}.
                                                                                        Для восстановления пароля используете код ниже:
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:46px;font-family: 'MailSans', Inter,Arial,sans-serif;font-weight:600;color:#007BFF;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        ${code}
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td align="left" class="x  m"
                                                                            style="font-size:0;padding-bottom:8px;word-break:break-word;">
                                                                            <div style="text-align:left;">
                                                                                <p
                                                                                    style="Margin:0;text-align:left;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                    <span
                                                                                        style="font-size:16px;font-family: 'MailSans', Inter,Arial,sans-serif;font-weight:400;color:#777777;line-height:150%;mso-line-height-alt:24px;mso-ansi-font-size:16px;">
                                                                                        Если запрос отправили не вы, свяжитесь с нашей службой технической поддержки по почте hello@clycon.com. 
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                            
                                                                    
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <table align="center" border="0" cellpadding="0" cellspacing="0" class="r-outlook -outlook pr-16-outlook pl-16-outlook -outlook" role="presentation" style="width:600px;" width="600"><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;">
            <![endif]-->
                    <div class="r  pr-16 pl-16"
                        style="box-sizing: border-box;width: 100%;background:#EDEFF2;background-color:#EDEFF2;margin:0px auto;max-width:600px;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"
                            style="background:#EDEFF2;background-color:#EDEFF2;width:100%;">
                            <tbody>
                                <tr>
                                    <td style="border:none;direction:ltr;font-size:0;padding:12px 0px 0px 0px;text-align:left;width: 10%">
                                        <!--[if mso | IE]>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="c-outlook -outlook -outlook" style="vertical-align:middle;width:568px;">
            <![endif]-->
                                        <div class="xc568 ogf c"
                                            style="background:#EDEFF2;background-color:#fff;margin:0px auto;max-width:600px;border-radius: 12px">
                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                style="border:none;vertical-align:middle;" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td align="center" vertical-align="middle" class="b  fw-1 m"
                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:separate;width:100%;line-height:100%;">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center" bgcolor="transparent" role="presentation"
                                                                            style="border:none;cursor:auto;mso-padding-alt:4px 0px 4px 0px;background:transparent;width: 100%"
                                                                            valign="middle"> <a href="tel:+79127864632"
                                                                                style="text-align:start;display:inline-block;width:100%;background:transparent;color:#ffffff;font-family: 'MailSans', Inter,Arial,sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:12px 22px 0px 22px;mso-padding-alt:0;"
                                                                                target="_blank"> <span
                                                                                    style="font-size:13px;font-family: 'MailSans', Inter,Arial,sans-serif;font-weight:700;color:#4d4d4d;line-height:123%;text-decoration:underline;mso-line-height-alt:16px;mso-ansi-font-size:14px;">+7 (912) 786-46-32 </span></a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td align="center" vertical-align="middle" class="b  fw-1 m"
                                                            style="font-size:0;padding:0;padding-bottom:8px;word-break:break-word;">
                                                            <table border="0" cellpadding="0" cellspacing="0" role="presentation"
                                                                style="border-collapse:separate;width:100%;line-height:100%;">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center" bgcolor="transparent" role="presentation"
                                                                            style="border:none;cursor:auto;mso-padding-alt:4px 0px 4px 0px;background:transparent;"
                                                                            valign="middle"> <a href="mailto:hello@clycon.com"
                                                                                style="text-align:start;display:inline-block;width:100%;background:transparent;color:#ffffff;font-family: 'MailSans', Inter,Arial,sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:4px 22px 12px 22px;mso-padding-alt:0;"
                                                                                target="_blank"> <span
                                                                                    style="font-size:13px;font-family: 'MailSans', Inter,Arial,sans-serif;font-weight:700;color:#4d4d4d;line-height:123%;text-decoration:underline;mso-line-height-alt:16px;mso-ansi-font-size:14px;">hello@clycon.com</span></a>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <tr>
                            <td align="center" valign="top">
                                <table class="mob_75_mr_css_attr" cellpadding="0" cellspacing="0" width="96%" border="0" style="max-width: 576px;min-width: 248px;">
                                    <tbody><tr>
                                        <td align="left">
                                            <div class="mob_h16_mr_css_attr" style="height: 20px;line-height: 20px;font-size: 8px;">&nbsp;</div>                                
                                            <a href="https://www.clycon.com" target="_blank" style="display: block;max-width: 128px;" rel=" noopener noreferrer">
                                                <img src="https://i.postimg.cc/bwzwjSxt/bottom-Mail-Logo.png" width="128" height="36" border="0" alt="" style="display: block;width: 100%;max-width: 128px;">
                                            </a>
                                            <div class="mob_h36_mr_css_attr" style="height: 48px;line-height: 48px;font-size: 8px;">&nbsp;</div>
                                        </td>
                                    </tr>
                                </tbody></table>
                            </td>
                        </tr>
                    </div>
                    <!--[if mso | IE]>
            </td></tr></table>
            <![endif]-->
                </div>
            </body>
            
            </html>
            `
        }
        
        transporter.sendMail(options, function(err, info) {
            if(err){
                console.log('\n\n\n', err, '\n\n\n');
                return;
            }
            console.log('\n\n\n', info.response, '\n\n\n');
        })
    }
}

module.exports = new MailSending()
