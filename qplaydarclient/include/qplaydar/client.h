#ifndef CLIENT_H
#define CLIENT_H

#include <QObject>
#include <QHash>
#include <QUrl>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QDebug>
#include <QPair>
#include <QUuid>

#include <qjson/parser.h>
#include <qjson/serializer.h>
#include <qjson/qobjecthelper.h>

#include "qplaydar.h"
#include "qplaydar/query.h"


typedef QPair<QString,QString> param;
typedef QList< param > paramlist;

namespace Playdar
{

class Client : public QObject
{
Q_OBJECT
public:
    enum KIND { HANDSHAKE, RESOLVE };

    explicit Client(QNetworkAccessManager* nam, QObject *parent = 0);
    // connect to playdar daemon:
    void handshake(QString host, int port);


signals:
    void handshakeOk(QVariantMap);
    void handshakeFailed();
    void onResult(Playdar::q_ptr, Playdar::r_ptr);

public slots:
    // tell daemon to start resolving:
    void resolve( const QString & str );
    void resolve( q_ptr qry );
    // convert result obj into URL to stream audio from:
    QString resultUrl(r_ptr r) const;
    QString resultUrl(const QString &str) const;

private slots:
    void handshakeCallFinished();
    void resolveCallFinished();
    void cometReadyRead();

private:
    void startComet();
    void gotCometChunk(const QString &);

    QUrl buildUrl(QString path, paramlist params);

    QHash< QString, q_ptr > m_queries;

    QJson::Parser * m_parser;

    QNetworkAccessManager * m_nam;
    QString m_cometid, m_cometbuffer;
    bool m_ready; // statted + authed?
    QString m_host; // localhost
    int m_port; // 60210
    QString m_baseurl;
};
} //ns
#endif // CLIENT_H
