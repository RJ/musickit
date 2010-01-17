#include <QDateTime>

#include "qplaydar/client.h"


using namespace Playdar;

Client::Client(QNetworkAccessManager* nam, QObject *parent) :
    QObject(parent)
{
    qsrand(QDateTime::currentDateTime().toTime_t()); // we need to do this to ensure 'random' starting point for uuids
    m_nam = nam;
    m_ready = false;
    m_parser = new QJson::Parser;
}

QString Client::resultUrl(const QString &str) const
{
    bool ok;
    QVariantMap json = m_parser->parse(str.toAscii(), &ok).toMap();
    if(ok)
    {
        r_ptr r(new Result);
        QJson::QObjectHelper::qvariant2qobject(json, r.data());
        return resultUrl(r);
    } else {
        qDebug() << "Failed to parse result in resultUrl call";
    }
}

QString Client::resultUrl(r_ptr r) const
{
    qDebug() << "resultUrl called for " << r->str();
    return QString("http://%1:%2/sid/%3").arg(m_host).arg(m_port).arg(r->sid());
}


void Client::handshake(QString host, int port)
{
    m_host = host;
    m_port = port;
    m_baseurl = QString("http://%1:%2").arg(m_host).arg(m_port);

    QUrl url(m_baseurl + "/api?method=stat");
    QNetworkRequest request(url);
    request.setRawHeader("Connection","close");
    qDebug() << url;

    QNetworkReply *reply = m_nam->get(request);
    connect(reply, SIGNAL(finished()), this, SLOT(handshakeCallFinished()));
    /*
    connect(reply, SIGNAL(error(QNetworkReply::NetworkError)),
            this, SLOT(slotError(QNetworkReply::NetworkError)));
    */
}

void Client::handshakeCallFinished()
{
    QNetworkReply * reply = qobject_cast<QNetworkReply*>(sender());
    QByteArray r = reply->readAll();
    qDebug() << "HS REPLY: " << reply->request().url() << "\n" << r << "\n";
    bool ok;
    QVariantMap json = m_parser->parse(r, &ok).toMap();
    if(!ok || r.length()==0)
    {
        emit(handshakeFailed());
    } else {
        m_ready = true;
        startComet();
        emit(handshakeOk(json)); // race condition, should really emit this when startComet managed to open its connection.
    }
    reply->deleteLater();
}

QUrl Client::buildUrl(QString path, paramlist params)
{
    QString url = m_baseurl + path + "?";
    for(int i=0; i<params.length(); i++)
    {
        url += QUrl::toPercentEncoding(params[i].first);
        url += "=";
        url += QUrl::toPercentEncoding(params[i].second);
        url += "&";
    }
    return QUrl(url);
}

void Client::resolve(const QString &str)
{
    bool ok;
    QVariantMap json = m_parser->parse(str.toAscii(), &ok).toMap();
    if(ok)
    {
        q_ptr q(new Query);
        QJson::QObjectHelper::qvariant2qobject(json, q.data());
        resolve(q);
    } else {
        qDebug() << "Failed to parse query in resolve call";
    }
}

void Client::resolve( q_ptr qry )
{
    m_queries.insert(qry->qid(), qry);
    paramlist p;
    p << param("method","resolve")
      << param("artist",qry->artist())
      << param("album", qry->album())
      << param("track", qry->track())
      << param("qid", qry->qid())
      << param("comet", m_cometid);

    QUrl url = buildUrl("/api", p);

    QNetworkRequest request(url);
    request.setRawHeader("Connection","close");
    qDebug() << url;
    QNetworkReply *reply = m_nam->get(request);
    connect(reply, SIGNAL(finished()), this, SLOT(resolveCallFinished()));
    //connect(reply, SIGNAL(finished()), m_signalmapper, SLOT(map()));
    //QPair< QNetworkReply*, KIND > * r = new QPair< QNetworkReply*, KIND >(reply,RESOLVE);
    //m_signalmapper->setMapping(reply, (QObject*)r);
}

void Client::resolveCallFinished()
{
    QNetworkReply * reply = qobject_cast<QNetworkReply*>(sender());
    QByteArray r = reply->readAll();
    qDebug() << "REPLY: " << reply->request().url() << "\n" << r << "\n";
    bool ok;
    QVariantMap json = m_parser->parse(r, &ok).toMap();
    Q_ASSERT(ok);
    QString qid = json["qid"].toString();
    qDebug() << "resolve call competed for " << qid;
    reply->deleteLater();
}


void Client::startComet()
{
    m_cometid = Utils::guid();
    paramlist p;
    p   << param("method", "comet")
        << param("mode", "raw")
        << param("id", m_cometid);
    QUrl url = buildUrl("/api",p);
    QNetworkRequest request(url);
    request.setRawHeader("Connection","close");
    qDebug() << url;
    QNetworkReply *reply = m_nam->get(request);
    connect(reply, SIGNAL(readyRead()), this, SLOT(cometReadyRead()));
}

void Client::cometReadyRead()
{
    // Since our json parser doesnt do streams of multiple top-level objects,
    // we rely on the fact that playdar separate objects with \n\n
    // and extract each top-level object manually before parsing.
    QNetworkReply * reply = qobject_cast<QNetworkReply*>(sender());
    QString data = reply->readAll();
    //qDebug() << "JUST READ: " << data;
    m_cometbuffer.append(data);
    QStringList objs = data.split("\n\n", QString::SkipEmptyParts);
    Q_ASSERT(!objs.isEmpty());
    QString str;
    while(objs.length())
    {
        str = objs.front();
        objs.pop_front();
        //qDebug() << "HANDLING: @" << str <<"@\n\n";
        if(objs.length()==0)
        {
            if(!data.endsWith("\n\n"))
            {
                m_cometbuffer = str;
                return;
            }
        }
        gotCometChunk(str);
    }
    //qDebug() << "~~~~~~~~~~~";
}

void Client::gotCometChunk(const QString &str)
{
    //qDebug() << "goCometChunk: " << str << "\n\n";
    bool ok;
    QVariantMap json = m_parser->parse(str.toAscii(), &ok).toMap();
    Q_ASSERT(ok);
    QString qid = json["qid"].toString();
    if(!m_queries.contains(qid))
    {
        qDebug() << "No such QID: " << qid;
        return;
    }
    Q_ASSERT(json["method"].toString() == "results");
    QVariantList list = json["results"].toList();
    for(int i=0; i<list.length(); i++)
    {
        r_ptr res(new Result);
        QJson::QObjectHelper::qvariant2qobject(list[i].toMap(), res.data());
        q_ptr q = m_queries.value(qid);
        q->addResult(res);
        emit(onResult(q,res));
    }
}
