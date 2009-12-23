# -------------------------------------------------
# Project created by QtCreator 2009-12-22T13:28:55
# -------------------------------------------------
QT += network \
    script \
    scripttools \
    webkit \
    xml \
    phonon
TARGET = musickit
TEMPLATE = app
SOURCES += main.cpp \
    mainwindow.cpp \
    WebkitApi.cpp
HEADERS += mainwindow.h \
    WebkitApi.h
FORMS += mainwindow.ui
